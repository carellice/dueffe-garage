package it.dueffe.garage

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private data class DataChoice(val config: ServerConfig, val phone: String, val server: String)

private fun counts(vehicles: Int, maintenances: Int, documents: Int) = "$vehicles auto · $maintenances interventi · $documents documenti"

/**
 * "Server Garage": the app can keep its data on the Garage server installed on CasaOS (the web version),
 * with the same account. Off, everything stays on the phone as before.
 */
@Composable internal fun ServerScreen(repo: GarageRepository, onBack: () -> Unit, onDataChanged: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val config by repo.serverStore.config.collectAsState()
    val status by repo.sync.status.collectAsState()
    val before = remember { File(context.filesDir, "dati-prima-del-server.json") }
    var url by remember { mutableStateOf(repo.serverStore.lastUrl) }
    var username by remember { mutableStateOf(repo.serverStore.lastUsername) }
    var password by remember { mutableStateOf("") }
    var register by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var choice by remember { mutableStateOf<DataChoice?>(null) }
    var disconnect by remember { mutableStateOf(false) }
    fun message(text: String) = Toast.makeText(context, text, Toast.LENGTH_SHORT).show()

    /** Turns server mode on with the phone's data or the server's; never leaves it half on. */
    fun finish(account: ServerConfig, usePhone: Boolean) = scope.launch {
        busy = true
        try {
            withContext(Dispatchers.IO) {
                repo.serverStore.save(account.url, account.username, account.token)
                val active = repo.serverStore.config.value ?: throw ServerException("Collegamento non riuscito")
                if (usePhone) repo.sync.importBackup(active, before.readBytes()) else repo.sync.pull(active, force = true)
            }
            password = ""
            onDataChanged()
            message("Server collegato")
        } catch (e: Exception) {
            repo.serverStore.clear()
            error = e.message ?: "Collegamento non riuscito"
        } finally { busy = false }
    }

    fun connect() = scope.launch {
        if (url.isBlank() || username.isBlank() || password.isEmpty()) { error = "Inserisci indirizzo, nome utente e password"; return@launch }
        busy = true; error = ""
        try {
            val address = ServerClient.normalizeUrl(url)
            url = address
            val token = repo.sync.login(address, username.trim(), password, register)
            val account = ServerConfig(address, username.trim(), token)
            // The phone's data as it is now, to go back to it when the server is turned off.
            val local = withContext(Dispatchers.IO) { before.writeBytes(repo.exportBackup()); repo.snapshot() }
            if (local.vehicles.isEmpty() && local.maintenances.isEmpty() && local.documents.isEmpty()) { busy = false; finish(account, usePhone = false); return@launch }
            val (v, m, d) = repo.sync.serverCounts(account)
            choice = DataChoice(account, counts(local.vehicles.size, local.maintenances.size, local.documents.size), counts(v, m, d))
        } catch (e: Exception) {
            error = e.message ?: "Collegamento non riuscito"
        } finally { busy = false }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 18.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        GarageBackButton("Impostazioni", onBack)
        SectionHeading("Sincronizzazione", "Server Garage", "Gli stessi dati della versione web, su ogni dispositivo.")
        val active = config
        if (active == null) {
            GlassCard(Modifier.fillMaxWidth().staggerIn(1), padding = 17.dp) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Collega il server", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text("Usa l'indirizzo di Garage sul tuo server CasaOS, per esempio quello di Tailscale. Senza connessione potrai consultare i dati ma non modificarli.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, lineHeight = 18.sp)
                    OutlinedTextField(url, { url = it; error = "" }, label = { Text("Indirizzo del server") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("casaos.tailXXXX.ts.net") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
                    if (url.trim().startsWith("http://", ignoreCase = true)) Text("Senza HTTPS la password viaggia in chiaro: usalo solo nella rete di casa.",
                        color = MaterialTheme.colorScheme.error, fontSize = 12.sp, lineHeight = 16.sp)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(!register, { register = false }, label = { Text("Ho già un account") }, modifier = Modifier.weight(1f))
                        FilterChip(register, { register = true }, label = { Text("Creane uno") }, modifier = Modifier.weight(1f))
                    }
                    OutlinedTextField(username, { username = it; error = "" }, label = { Text("Nome utente") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(password, { password = it; error = "" }, label = { Text("Password") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                        visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                    if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    GradientButton(onClick = { if (!busy) connect() }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp), enabled = !busy) {
                        Text(if (busy) "Collegamento…" else "Collega il server", fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            GlassCard(Modifier.fillMaxWidth().staggerIn(1), padding = 17.dp) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Attivo", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text("${active.username} su ${active.url.substringAfter("://")}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    Text(when {
                        status.error.isNotBlank() -> status.error
                        status.updatedAt > 0 -> "Aggiornato alle " + SimpleDateFormat("HH:mm", Locale.ITALY).format(Date(status.updatedAt))
                        else -> "In attesa del primo aggiornamento"
                    }, color = if (status.error.isNotBlank()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    Text("Le modifiche vanno subito sul server; senza connessione i dati restano consultabili ma non modificabili.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, lineHeight = 17.sp)
                    GradientButton(onClick = { scope.launch { busy = true; if (repo.refreshFromServer(force = true)) onDataChanged(); busy = false } },
                        modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp), enabled = !busy) {
                        Text(if (busy) "Aggiornamento…" else "Aggiorna ora", fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(onClick = { disconnect = true }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Scollega il server", fontWeight = FontWeight.SemiBold) }
                }
            }
        }
    }

    choice?.let { pending ->
        AlertDialog(onDismissRequest = { choice = null; scope.launch { repo.sync.logout(pending.config) } },
            title = { Text("Quali dati vuoi usare?") },
            text = { Text("Sul telefono: ${pending.phone}\nSul server: ${pending.server}\n\nI dati scelti sostituiscono gli altri sul server e sul telefono. Una copia dei dati del telefono resta salvata per tornare indietro.") },
            confirmButton = { TextButton(onClick = { choice = null; finish(pending.config, usePhone = false) }) { Text("Quelli del server") } },
            dismissButton = { TextButton(onClick = { choice = null; finish(pending.config, usePhone = true) }) { Text("Quelli del telefono") } })
    }

    if (disconnect) {
        val canRestore = before.exists()
        AlertDialog(onDismissRequest = { disconnect = false },
            title = { Text("Scollega il server") },
            text = { Text(if (canRestore) "I dati restano sul server. Sul telefono puoi tenere quelli attuali o tornare a quelli di prima del collegamento." else "I dati restano sul server; il telefono tiene quelli attuali.") },
            confirmButton = { TextButton(onClick = {
                disconnect = false
                scope.launch {
                    config?.let { repo.sync.logout(it) }
                    repo.serverStore.clear()
                    withContext(Dispatchers.IO) { before.delete() }
                    onDataChanged(); message("Server scollegato")
                }
            }) { Text("Tieni i dati attuali") } },
            dismissButton = { if (canRestore) TextButton(onClick = {
                disconnect = false
                scope.launch {
                    config?.let { repo.sync.logout(it) }
                    repo.serverStore.clear()
                    runCatching { withContext(Dispatchers.IO) { repo.importBackup(before.readBytes()); before.delete() } }
                        .onFailure { message("Ripristino non riuscito: ${it.message}") }
                    onDataChanged(); message("Server scollegato")
                }
            }) { Text("Torna a quelli di prima") } })
    }
}
