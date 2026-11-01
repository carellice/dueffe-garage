package it.dueffe.garage

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/** What the server settings show: when the local copy was last refreshed, or the last error. */
data class SyncStatus(val updatedAt: Long = 0L, val error: String = "")

/**
 * "Server mode": the Garage server is the source of truth and the local database is its copy, so the
 * screens keep reading the phone. Every change goes to the server first, then the copy is reloaded.
 * Without the server the app can read but not change anything.
 */
class ServerSync(private val repo: GarageRepository, val store: ServerStore, private val client: ServerClient = ServerClient()) {
    private val mutex = Mutex()
    private val _status = MutableStateFlow(SyncStatus())
    val status: StateFlow<SyncStatus> = _status.asStateFlow()

    /** Reloads the local copy when the server data changed. True when something changed. */
    suspend fun pull(config: ServerConfig, force: Boolean = false): Boolean = mutex.withLock { pullLocked(config, force) }

    /** Runs one change on the server, then refreshes the copy. */
    suspend fun write(config: ServerConfig, call: suspend () -> Unit) = mutex.withLock {
        call()
        pullLocked(config, false)
    }

    private suspend fun pullLocked(config: ServerConfig, force: Boolean): Boolean {
        try {
            val state = client.state(config, if (force) -1 else store.revision)
            if (state.optBoolean("unchanged")) {
                _status.value = SyncStatus(System.currentTimeMillis())
                return false
            }
            val local = repo.snapshot()
            // Photos and files are downloaded only when they changed since the last copy.
            val vehicles = state.getJSONArray("vehicles").objects().map { j ->
                val vehicle = vehicleFrom(j, null)
                val known = local.vehicles.firstOrNull { it.id == vehicle.id }?.photo
                val photo = when {
                    !j.optBoolean("hasPhoto") -> null
                    known != null && known.size == j.optInt("photoSize", -1) -> known
                    else -> client.file(config, "vehicle", vehicle.id)
                }
                vehicle.copy(photo = photo)
            }
            val maintenances = state.getJSONArray("maintenances").objects().map(::maintenanceFrom)
            val reminders = state.getJSONArray("reminders").objects().map(::reminderFrom)
            val documents = state.getJSONArray("documents").objects().map { j ->
                val meta = documentFrom(j, byteArrayOf())
                val known = local.documents.firstOrNull { it.id == meta.id && it.updatedAt == meta.updatedAt && it.data.size == meta.size }?.data
                meta.copy(data = known ?: client.file(config, "document", meta.id))
            }
            repo.replaceAll(GarageState(vehicles, maintenances, reminders, documents))
            store.revision = state.getLong("revision")
            _status.value = SyncStatus(System.currentTimeMillis())
            return true
        } catch (e: Exception) {
            _status.value = _status.value.copy(error = e.message ?: "Aggiornamento non riuscito")
            throw e
        }
    }

    // --- the writes of GarageRepository, as calls to the server -----------------------------------

    suspend fun saveVehicle(config: ServerConfig, vehicle: Vehicle) = write(config) {
        val current = repo.snapshot().vehicles.firstOrNull { it.id == vehicle.id }?.photo
        val body = JSONObject().put("vehicle", vehicleJson(vehicle))
        when {
            vehicle.photo == null -> body.put("photo", JSONObject.NULL)
            current == null || !current.contentEquals(vehicle.photo) -> body.put("photo", dataUrl("image/jpeg", vehicle.photo))
        }
        client.post(config, "/api/vehicles", body)
    }

    suspend fun saveMaintenance(config: ServerConfig, maintenance: Maintenance, reminder: Reminder?) = write(config) {
        client.post(config, "/api/maintenances", JSONObject().put("maintenance", maintenanceJson(maintenance))
            .put("reminder", reminder?.let(::reminderJson) ?: JSONObject.NULL))
    }

    suspend fun saveDocument(config: ServerConfig, document: GarageDocument) = write(config) {
        val current = repo.snapshot().documents.firstOrNull { it.id == document.id }?.data
        val body = JSONObject().put("document", documentJson(document))
        if (current == null || !current.contentEquals(document.data)) body.put("data", dataUrl(document.mimeType.ifBlank { "application/octet-stream" }, document.data))
        client.post(config, "/api/documents", body)
    }

    suspend fun delete(config: ServerConfig, kind: String, id: String) = write(config) {
        client.delete(config, "/api/$kind/" + URLEncoder.encode(id, "UTF-8").replace("+", "%20"))
    }

    suspend fun clear(config: ServerConfig) = write(config) { client.post(config, "/api/clear", JSONObject()) }

    /** Replaces the account's data on the server with a backup in the app's format. */
    suspend fun importBackup(config: ServerConfig, bytes: ByteArray) = write(config) { client.importBackup(config, bytes) }

    /** Counts on the server, for "Quali dati vuoi usare?". */
    suspend fun serverCounts(config: ServerConfig): Triple<Int, Int, Int> {
        val state = client.state(config, -1)
        return Triple(state.getJSONArray("vehicles").length(), state.getJSONArray("maintenances").length(), state.getJSONArray("documents").length())
    }

    suspend fun login(url: String, username: String, password: String, register: Boolean) = client.login(url, username, password, register)

    suspend fun logout(config: ServerConfig) = client.logout(config)

    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
}
