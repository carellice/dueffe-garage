package it.dueffe.garage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.net.Uri
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

data class Vehicle(
    val id: String = UUID.randomUUID().toString(), val name: String = "", val make: String = "",
    val model: String = "", val year: Int = LocalDate.now().year, val plate: String = "",
    val mileage: Int = 0, val registrationDate: String = "", val photo: ByteArray? = null,
    val notes: String = "", val notesUpdatedAt: String = "", val status: String = "active",
    val statusDate: String = "", val statusNote: String = "", val addedAt: String = now(),
    val createdAt: String = now(), val updatedAt: String = now(), val fuel: String = "",
    val vehicleType: String = "car"
)
data class Maintenance(
    val id: String = UUID.randomUUID().toString(), val vehicleId: String, val type: String = "service",
    val customName: String = "", val date: String = LocalDate.now().toString(), val mileage: Int = 0,
    val cost: Double = 0.0, val notes: String = "", val createdAt: String = now(), val updatedAt: String = now()
)
data class Reminder(
    val id: String = UUID.randomUUID().toString(), val maintenanceId: String, val type: String = "interval",
    val dueDate: String = "", val mileageThreshold: Int? = null, val intervalValue: Int? = null,
    val intervalUnit: String = "", val active: Boolean = true, val createdAt: String = now(), val updatedAt: String = now()
)
data class GarageDocument(
    val id: String = UUID.randomUUID().toString(), val vehicleId: String, val name: String,
    val mimeType: String, val category: String, val size: Int, val data: ByteArray,
    val addedAt: String = now(), val updatedAt: String = now(), val maintenanceId: String? = null
)
data class GarageState(
    val vehicles: List<Vehicle> = emptyList(), val maintenances: List<Maintenance> = emptyList(),
    val reminders: List<Reminder> = emptyList(), val documents: List<GarageDocument> = emptyList()
)
data class DueReminder(val reminder: Reminder, val maintenance: Maintenance, val vehicle: Vehicle, val days: Long?, val kmLeft: Int?)

fun now(): String = java.time.Instant.now().toString()
fun JSONObject.string(key: String) = optString(key, "")
fun JSONObject.nullableInt(key: String): Int? = if (isNull(key) || !has(key)) null else optInt(key)

class GarageRepository(private val context: Context) : SQLiteOpenHelper(context, "dueffe-garage-native.db", null, 1) {
    private val prefs = context.getSharedPreferences("garage_preferences", Context.MODE_PRIVATE)
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE item (kind TEXT NOT NULL, id TEXT NOT NULL, parent TEXT, payload TEXT NOT NULL, binary BLOB, PRIMARY KEY(kind,id))")
        db.execSQL("CREATE INDEX item_parent ON item(kind,parent)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    var theme: String
        get() = prefs.getString("theme", "system") ?: "system"
        set(value) { prefs.edit().putString("theme", value).apply(); GarageWidget.refresh(context) }
    var onboardingDone: Boolean
        get() = prefs.getBoolean("onboarding", false)
        set(value) { prefs.edit().putBoolean("onboarding", value).apply() }
    var lastExportAt: String
        get() = prefs.getString("lastExport", "") ?: ""
        set(value) { prefs.edit().putString("lastExport", value).apply() }
    var notificationsEnabled: Boolean
        get() = prefs.getBoolean("notifications", false)
        set(value) { prefs.edit().putBoolean("notifications", value).apply() }
    var notificationLeadDays: Int
        get() = prefs.getInt("leadDays", 7)
        set(value) { prefs.edit().putInt("leadDays", value.coerceIn(1, 30)).apply() }
    var protectionEnabled: Boolean
        get() = prefs.getBoolean("protection", false)
        set(value) { prefs.edit().putBoolean("protection", value).apply(); GarageWidget.refresh(context) }
    var biometricEnabled: Boolean
        get() = prefs.getBoolean("biometric", false)
        set(value) { prefs.edit().putBoolean("biometric", value).apply() }
    val hasPin: Boolean get() = prefs.contains("pinHash") && prefs.contains("pinSalt")
    val pinLength: Int get() = prefs.getInt("pinLength", 0)
    fun setPin(pin: String) {
        require(pin.length in 4..8 && pin.all(Char::isDigit)) { "Il PIN deve avere da 4 a 8 cifre" }
        val salt = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
        val hash = pinHash(pin, salt)
        prefs.edit().putString("pinSalt", Base64.encodeToString(salt, Base64.NO_WRAP))
            .putString("pinHash", Base64.encodeToString(hash, Base64.NO_WRAP)).putInt("pinLength", pin.length).commit()
    }
    fun verifyPin(pin: String): Boolean {
        if (!hasPin) return false
        return runCatching {
            val salt = Base64.decode(prefs.getString("pinSalt", ""), Base64.DEFAULT)
            val expected = Base64.decode(prefs.getString("pinHash", ""), Base64.DEFAULT)
            java.security.MessageDigest.isEqual(expected, pinHash(pin, salt)).also { valid ->
                if (valid && pinLength == 0) prefs.edit().putInt("pinLength", pin.length).apply()
            }
        }.getOrDefault(false)
    }
    private fun pinHash(pin: String, salt: ByteArray): ByteArray {
        val spec = javax.crypto.spec.PBEKeySpec(pin.toCharArray(), salt, 120_000, 256)
        return try { javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded }
        finally { spec.clearPassword() }
    }
    val lastChangeAt: String get() = prefs.getString("lastChange", "") ?: ""
    private fun changed() { prefs.edit().putString("lastChange", now()).apply(); GarageWidget.refresh(context) }

    private fun put(db: SQLiteDatabase, kind: String, id: String, parent: String?, json: JSONObject, bytes: ByteArray? = null) {
        db.insertWithOnConflict("item", null, ContentValues().apply {
            put("kind", kind); put("id", id); put("parent", parent); put("payload", json.toString()); put("binary", bytes)
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }
    private fun rows(kind: String): List<Pair<JSONObject, ByteArray?>> {
        val result = mutableListOf<Pair<JSONObject, ByteArray?>>()
        readableDatabase.query("item", arrayOf("payload", "binary"), "kind=?", arrayOf(kind), null, null, null).use { cursor ->
            while (cursor.moveToNext()) result += JSONObject(cursor.getString(0)) to cursor.getBlob(1)
        }
        return result
    }
    fun snapshot() = GarageState(
        rows("vehicle").map { (j, b) -> vehicleFrom(j, b) }.sortedBy { it.name.lowercase() },
        rows("maintenance").map { (j, _) -> maintenanceFrom(j) }.sortedByDescending { it.date },
        rows("reminder").map { (j, _) -> reminderFrom(j) },
        rows("document").map { (j, b) -> documentFrom(j, b ?: byteArrayOf()) }.sortedByDescending { it.addedAt }
    )
    fun save(vehicle: Vehicle) { put(writableDatabase, "vehicle", vehicle.id, null, vehicleJson(vehicle), vehicle.photo); changed() }
    fun save(maintenance: Maintenance, reminder: Reminder?) {
        writableDatabase.beginTransaction()
        try {
            put(writableDatabase, "maintenance", maintenance.id, maintenance.vehicleId, maintenanceJson(maintenance))
            writableDatabase.delete("item", "kind='reminder' AND parent=?", arrayOf(maintenance.id))
            if (reminder != null) put(writableDatabase, "reminder", reminder.id, maintenance.id, reminderJson(reminder))
            val vehicle = snapshot().vehicles.firstOrNull { it.id == maintenance.vehicleId }
            if (vehicle != null && maintenance.mileage > vehicle.mileage) put(writableDatabase, "vehicle", vehicle.id, null, vehicleJson(vehicle.copy(mileage = maintenance.mileage, updatedAt = now())), vehicle.photo)
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
        changed()
    }
    fun save(document: GarageDocument) { put(writableDatabase, "document", document.id, document.vehicleId, documentJson(document), document.data); changed() }
    fun deleteVehicle(id: String) {
        writableDatabase.beginTransaction()
        try {
            val maintenanceIds = snapshot().maintenances.filter { it.vehicleId == id }.map { it.id }
            maintenanceIds.forEach { writableDatabase.delete("item", "kind='reminder' AND parent=?", arrayOf(it)) }
            listOf("maintenance", "document").forEach { writableDatabase.delete("item", "kind=? AND parent=?", arrayOf(it, id)) }
            writableDatabase.delete("item", "kind='vehicle' AND id=?", arrayOf(id))
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
        changed()
    }
    fun deleteMaintenance(id: String) {
        writableDatabase.beginTransaction()
        try {
            rows("document").map { (j, bytes) -> documentFrom(j, bytes ?: byteArrayOf()) }
                .filter { it.maintenanceId == id }
                .forEach { document ->
                    val unlinked = document.copy(maintenanceId = null, updatedAt = now())
                    put(writableDatabase, "document", unlinked.id, unlinked.vehicleId, documentJson(unlinked), unlinked.data)
                }
            writableDatabase.delete("item", "kind='reminder' AND parent=?", arrayOf(id))
            writableDatabase.delete("item", "kind='maintenance' AND id=?", arrayOf(id))
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
        changed()
    }
    fun deleteReminder(id: String) { writableDatabase.delete("item", "kind='reminder' AND id=?", arrayOf(id)); changed() }
    fun deleteDocument(id: String) { writableDatabase.delete("item", "kind='document' AND id=?", arrayOf(id)); changed() }
    fun clear() { writableDatabase.delete("item", null, null); changed() }

    fun exportBackup(): ByteArray {
        val state = snapshot()
        val data = JSONObject().put("vehicles", JSONArray().apply { state.vehicles.forEach { put(vehicleJson(it).apply { if (it.photo != null) put("photo", dataUrl("image/jpeg", it.photo)) }) } })
            .put("maintenances", JSONArray().apply { state.maintenances.forEach { put(maintenanceJson(it)) } })
            .put("reminders", JSONArray().apply { state.reminders.forEach { put(reminderJson(it)) } })
            .put("documents", JSONArray().apply { state.documents.forEach { put(documentJson(it).put("data", dataUrl(it.mimeType, it.data))) } })
        return JSONObject().put("product", "Garage").put("formatVersion", 1).put("exportedAt", now())
            .put("installationId", prefs.getString("installationId", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("installationId", it).apply() })
            .put("data", data).toString(2).toByteArray(Charsets.UTF_8)
    }
    fun importBackup(bytes: ByteArray) {
        require(bytes.size <= 250 * 1024 * 1024) { "Backup oltre 250 MB" }
        val root = JSONObject(bytes.toString(Charsets.UTF_8))
        require(root.string("product") in setOf("Garage", "Dueffe Garage") && root.optInt("formatVersion") == 1) { "Formato backup non supportato" }
        val data = root.getJSONObject("data")
        fun array(key: String) = data.getJSONArray(key).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
        val vehicles = array("vehicles").map { vehicleFrom(it, it.optString("photo").takeIf(String::isNotEmpty)?.let(::decodeDataUrl)) }
        val maintenances = array("maintenances").map(::maintenanceFrom)
        val reminders = array("reminders").map(::reminderFrom)
        val documents = array("documents").map { documentFrom(it, decodeDataUrl(it.getString("data"))) }
        require(vehicles.all { it.id.isNotBlank() && it.name.isNotBlank() && it.make.isNotBlank() && it.plate.isNotBlank() } && vehicles.map { it.id }.distinct().size == vehicles.size) { "Auto non valide o duplicate" }
        val vehicleIds = vehicles.map { it.id }.toSet()
        require(maintenances.all { it.id.isNotBlank() && it.vehicleId in vehicleIds } && maintenances.map { it.id }.distinct().size == maintenances.size) { "Manutenzioni non valide" }
        val maintenanceIds = maintenances.map { it.id }.toSet()
        require(reminders.all { it.id.isNotBlank() && it.maintenanceId in maintenanceIds } && reminders.map { it.id }.distinct().size == reminders.size) { "Promemoria non validi" }
        val maintenanceVehicles = maintenances.associate { it.id to it.vehicleId }
        require(documents.all { it.id.isNotBlank() && it.name.isNotBlank() && it.vehicleId in vehicleIds && it.data.isNotEmpty() &&
            (it.maintenanceId == null || maintenanceVehicles[it.maintenanceId] == it.vehicleId) } &&
            documents.map { it.id }.distinct().size == documents.size) { "Documenti non validi" }
        writableDatabase.beginTransaction()
        try {
            writableDatabase.delete("item", null, null)
            vehicles.forEach { put(writableDatabase, "vehicle", it.id, null, vehicleJson(it), it.photo) }
            maintenances.forEach { put(writableDatabase, "maintenance", it.id, it.vehicleId, maintenanceJson(it)) }
            reminders.forEach { put(writableDatabase, "reminder", it.id, it.maintenanceId, reminderJson(it)) }
            documents.forEach { put(writableDatabase, "document", it.id, it.vehicleId, documentJson(it), it.data) }
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
        changed()
    }
    // --- server mode: the Garage server on CasaOS keeps the data, this database is its copy ---------

    val serverStore = ServerStore(context)
    val sync = ServerSync(this, serverStore)
    /** Messages of writes that did not reach the server; the activity shows them. */
    val errors = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val serverMode: Boolean get() = serverStore.config.value != null

    /** Replaces the local copy with the server data (ServerSync.pull). */
    fun replaceAll(state: GarageState) {
        writableDatabase.beginTransaction()
        try {
            writableDatabase.delete("item", null, null)
            state.vehicles.forEach { put(writableDatabase, "vehicle", it.id, null, vehicleJson(it), it.photo) }
            state.maintenances.forEach { put(writableDatabase, "maintenance", it.id, it.vehicleId, maintenanceJson(it)) }
            state.reminders.forEach { put(writableDatabase, "reminder", it.id, it.maintenanceId, reminderJson(it)) }
            state.documents.forEach { put(writableDatabase, "document", it.id, it.vehicleId, documentJson(it), it.data) }
            writableDatabase.setTransactionSuccessful()
        } finally { writableDatabase.endTransaction() }
        changed()
    }

    /** Local mode runs the phone code as before; server mode sends the change. False when it failed (the form stays open). */
    private suspend fun either(local: () -> Unit, remote: suspend (ServerConfig) -> Unit): Boolean = withContext(Dispatchers.IO) {
        val config = serverStore.config.value
        if (config == null) { local(); true }
        else try { remote(config); true } catch (e: Exception) { errors.tryEmit(e.message ?: "Server non raggiungibile"); false }
    }

    suspend fun saveAsync(vehicle: Vehicle) = either({ save(vehicle) }) { sync.saveVehicle(it, vehicle) }
    suspend fun saveAsync(maintenance: Maintenance, reminder: Reminder?) = either({ save(maintenance, reminder) }) { sync.saveMaintenance(it, maintenance, reminder) }
    suspend fun saveAsync(document: GarageDocument) = either({ save(document) }) { sync.saveDocument(it, document) }
    suspend fun deleteVehicleAsync(id: String) = either({ deleteVehicle(id) }) { sync.delete(it, "vehicles", id) }
    suspend fun deleteMaintenanceAsync(id: String) = either({ deleteMaintenance(id) }) { sync.delete(it, "maintenances", id) }
    suspend fun deleteReminderAsync(id: String) = either({ deleteReminder(id) }) { sync.delete(it, "reminders", id) }
    suspend fun deleteDocumentAsync(id: String) = either({ deleteDocument(id) }) { sync.delete(it, "documents", id) }
    suspend fun clearAsync() = either({ clear() }) { sync.clear(it) }

    /** Throws with the reason when the backup is refused, in both modes. */
    suspend fun importBackupAsync(bytes: ByteArray) = withContext(Dispatchers.IO) {
        val config = serverStore.config.value
        if (config == null) importBackup(bytes) else sync.importBackup(config, bytes)
    }

    /** Reloads the copy from the server; true when the data changed. Does nothing on the phone only. */
    suspend fun refreshFromServer(force: Boolean = false): Boolean = withContext(Dispatchers.IO) {
        val config = serverStore.config.value ?: return@withContext false
        try { sync.pull(config, force) } catch (e: Exception) { false }
    }

    fun readUri(uri: Uri, maxBytes: Int = 10 * 1024 * 1024): ByteArray {
        val stream = context.contentResolver.openInputStream(uri) ?: error("File non leggibile")
        return stream.use { input ->
            val output = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
            while (true) { val count = input.read(buffer); if (count < 0) break; require(output.size() + count <= maxBytes) { "File troppo grande" }; output.write(buffer, 0, count) }
            output.toByteArray()
        }
    }
}

internal fun dataUrl(mime: String, bytes: ByteArray) = "data:$mime;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
internal fun decodeDataUrl(value: String): ByteArray { require(value.startsWith("data:") && value.contains(",")) { "File nel backup non valido" }; return Base64.decode(value.substringAfter(','), Base64.DEFAULT) }
internal fun vehicleJson(v: Vehicle) = JSONObject().put("id", v.id).put("name", v.name).put("make", v.make).put("model", v.model).put("year", v.year).put("plate", v.plate).put("mileage", v.mileage).put("registrationDate", v.registrationDate).put("fuel", v.fuel).put("vehicleType", v.vehicleType).put("notes", v.notes).put("notesUpdatedAt", v.notesUpdatedAt).put("status", v.status).put("statusDate", v.statusDate).put("statusNote", v.statusNote).put("addedAt", v.addedAt).put("createdAt", v.createdAt).put("updatedAt", v.updatedAt)
internal fun maintenanceJson(m: Maintenance) = JSONObject().put("id", m.id).put("vehicleId", m.vehicleId).put("type", m.type).put("customName", m.customName).put("date", m.date).put("mileage", m.mileage).put("cost", m.cost).put("notes", m.notes).put("createdAt", m.createdAt).put("updatedAt", m.updatedAt)
internal fun reminderJson(r: Reminder) = JSONObject().put("id", r.id).put("maintenanceId", r.maintenanceId).put("type", r.type).put("dueDate", r.dueDate).put("mileageThreshold", r.mileageThreshold).put("intervalValue", r.intervalValue).put("intervalUnit", r.intervalUnit).put("active", r.active).put("createdAt", r.createdAt).put("updatedAt", r.updatedAt)
internal fun documentJson(d: GarageDocument) = JSONObject().put("id", d.id).put("vehicleId", d.vehicleId).put("name", d.name).put("mimeType", d.mimeType).put("category", d.category).put("size", d.size).put("addedAt", d.addedAt).put("updatedAt", d.updatedAt).put("maintenanceId", d.maintenanceId ?: JSONObject.NULL)
internal fun vehicleFrom(j: JSONObject, photo: ByteArray?) = Vehicle(j.string("id"), j.string("name"), j.string("make"), j.string("model"), j.optInt("year"), j.string("plate"), j.optInt("mileage"), j.string("registrationDate"), photo, j.string("notes"), j.string("notesUpdatedAt"), j.optString("status", "active"), j.string("statusDate"), j.string("statusNote"), j.string("addedAt"), j.string("createdAt"), j.string("updatedAt"), j.string("fuel"), j.optString("vehicleType", "car").ifBlank { "car" })
internal fun maintenanceFrom(j: JSONObject) = Maintenance(j.string("id"), j.string("vehicleId"), j.string("type"), j.string("customName"), j.string("date"), j.optInt("mileage"), j.optDouble("cost"), j.string("notes"), j.string("createdAt"), j.string("updatedAt"))
internal fun reminderFrom(j: JSONObject) = Reminder(j.string("id"), j.string("maintenanceId"), j.string("type"), j.string("dueDate"), j.nullableInt("mileageThreshold"), j.nullableInt("intervalValue"), j.string("intervalUnit"), j.optBoolean("active", true), j.string("createdAt"), j.string("updatedAt"))
internal fun documentFrom(j: JSONObject, bytes: ByteArray) = GarageDocument(j.string("id"), j.string("vehicleId"), j.string("name"), j.string("mimeType"), j.string("category"), j.optInt("size", bytes.size), bytes, j.string("addedAt"), j.string("updatedAt"), j.optString("maintenanceId").takeIf { it.isNotBlank() && it != "null" })

fun dueReminders(state: GarageState): List<DueReminder> = state.reminders.mapNotNull { r ->
    val m = state.maintenances.firstOrNull { it.id == r.maintenanceId } ?: return@mapNotNull null
    val v = state.vehicles.firstOrNull { it.id == m.vehicleId && it.status == "active" } ?: return@mapNotNull null
    if (!r.active) return@mapNotNull null
    val dueDate = if (r.type == "interval" && r.intervalValue != null) runCatching { LocalDate.parse(m.date).let { if (r.intervalUnit == "months") it.plusMonths(r.intervalValue.toLong()) else it.plusYears(r.intervalValue.toLong()) }.toString() }.getOrNull() else r.dueDate.takeIf { it.isNotBlank() }
    val dateDays = dueDate?.let { runCatching { ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(it)) }.getOrNull() }
    val kmLeft = r.mileageThreshold?.minus(v.mileage)
    val mileageEstimate = kmLeft?.let { if (it <= 0) -1L else (it + 49L) / 50L }
    val days = when (r.type) { "mileage" -> mileageEstimate; "both" -> listOfNotNull(dateDays, mileageEstimate).minOrNull(); else -> dateDays }
    DueReminder(r, m, v, days, kmLeft)
}.sortedBy { it.days ?: Long.MAX_VALUE }
