package it.dueffe.garage

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Settings as grouped lists, like a car's settings menu: one group per topic, one row per choice. */
@Composable internal fun SettingsScreen(
    onBack: () -> Unit,
    theme: String, changeTheme: (String) -> Unit, lastChange: String, lastExport: String,
    notifications: Boolean, onNotifications: (Boolean) -> Unit, leadDays: Int, onLeadDays: (Int) -> Unit,
    protection: Boolean, onProtection: (Boolean) -> Unit, hasPin: Boolean, onChangePin: () -> Unit,
    biometric: Boolean, biometricAvailable: Boolean, onBiometric: (Boolean) -> Unit, onLock: () -> Unit,
    onExport: () -> Unit, onImport: () -> Unit, onOnboarding: () -> Unit, onClear: () -> Unit,
    serverActive: Boolean = false, onServer: () -> Unit = {}
) {
    var clearConfirm by remember { mutableStateOf(false) }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    LazyColumn(contentPadding = PaddingValues(bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item { PageTopBar("", onBack, "Garage") }
        item { PageHeading("Garage", "Impostazioni", "Il tuo spazio, come piace a te.", Modifier.padding(horizontal = 20.dp).staggerIn(0)) }
        item {
            SettingsGroup("Aspetto", 1) {
                Row(Modifier.fillMaxWidth().padding(12.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("system" to "Automatico", "light" to "Chiaro", "dark" to "Scuro").forEach { (key, label) ->
                        val selected = theme == key
                        val bg by animateColorAsState(if (selected) MaterialTheme.colorScheme.primary else Color.Transparent, tween(220), label = "theme_bg")
                        Box(Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(bg).bouncyClick(role = Role.RadioButton) { changeTheme(key) }.padding(vertical = 11.dp),
                            contentAlignment = Alignment.Center) {
                            Text(label, color = if (selected) onAccent() else muted, fontSize = 13.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
                        }
                    }
                }
            }
        }
        item {
            SettingsGroup("Scadenze", 2) {
                SwitchRow(R.drawable.ic_calendar_nav, "Notifiche", "Avvisami delle prossime scadenze", notifications, onNotifications)
                AnimatedVisibility(notifications) {
                    Column {
                        RowDivider()
                        Column(Modifier.padding(start = 72.dp, end = 16.dp, top = 12.dp, bottom = 6.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Preavviso", fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                                Text("$leadDays ${if (leadDays == 1) "giorno" else "giorni"}", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, style = Numeric)
                            }
                            Slider(value = leadDays.toFloat(), onValueChange = { onLeadDays(it.toInt().coerceIn(1, 30)) }, valueRange = 1f..30f)
                        }
                    }
                }
            }
        }
        item {
            SettingsGroup("Privacy e accesso", 3, footer = "Il blocco protegge l'accesso all'app; i backup esportati non sono cifrati.") {
                SwitchRow(R.drawable.ic_shield, "Proteggi Garage", "Richiedi il PIN all'apertura", protection, onProtection)
                if (protection) {
                    RowDivider()
                    SwitchRow(R.drawable.ic_settings_nav, "Biometria", if (biometricAvailable) "Usa impronta o volto" else "Non disponibile su questo dispositivo",
                        biometric, onBiometric, enabled = biometricAvailable && hasPin)
                    RowDivider()
                    ActionRow(R.drawable.ic_edit, "Cambia PIN", onClick = onChangePin)
                    RowDivider()
                    ActionRow(R.drawable.ic_shield, "Blocca adesso", onClick = onLock)
                }
            }
        }
        item {
            val backupStatus = if (lastExport.isBlank()) "Nessun backup esportato" else if (lastChange > lastExport) "Un nuovo backup è consigliato" else "Backup aggiornato"
            SettingsGroup("I tuoi dati", 4, footer = "Il file include foto e documenti e non è cifrato.") {
                ActionRow(R.drawable.ic_share, "Esporta backup", backupStatus, onClick = onExport)
                RowDivider()
                ActionRow(R.drawable.ic_folder, "Importa backup", "Sostituisce i dati attuali", onClick = onImport)
                RowDivider()
                ActionRow(R.drawable.ic_layers, "Server Garage", if (serverActive) "Attivo: i dati sono sul tuo server CasaOS" else "Spento: i dati restano solo sul telefono", onClick = onServer)
            }
        }
        item {
            SettingsGroup("App", 5) {
                ActionRow(R.drawable.ic_note, "Rivedi l'introduzione", onClick = onOnboarding)
            }
        }
        item { Box(Modifier.padding(horizontal = 18.dp).staggerIn(6)) { it.dueffe.updates.AppUpdateCard("garage", it.dueffe.garage.BuildConfig.UPDATE_REPOSITORY) } }
        item {
            SettingsGroup("Zona pericolosa", 7) {
                ActionRow(R.drawable.ic_delete, "Elimina tutti i dati", "Auto, interventi e documenti", destructive = true, onClick = { clearConfirm = true })
            }
        }
    }
    if (clearConfirm) ConfirmDelete("Eliminare definitivamente auto, interventi e documenti?", { clearConfirm = false }, { onClear(); clearConfirm = false })
}

@Composable private fun SettingsGroup(title: String, index: Int, footer: String = "", content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.padding(horizontal = 18.dp).staggerIn(index)) {
        Overline(title, Modifier.padding(start = 4.dp, bottom = 8.dp))
        Panel(Modifier.fillMaxWidth(), padding = 0.dp, content = content)
        if (footer.isNotBlank()) Text(footer, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(start = 4.dp, top = 8.dp))
    }
}

@Composable private fun SwitchRow(icon: Int, title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit, enabled: Boolean = true) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        AccentBadge(icon, 42.dp, 20.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        }
        Switch(checked, onCheckedChange, enabled = enabled)
    }
}

@Composable private fun ActionRow(icon: Int, title: String, subtitle: String = "", destructive: Boolean = false, onClick: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Row(Modifier.fillMaxWidth().bouncyClick(onClickLabel = title, role = Role.Button, onClick = onClick).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        if (destructive) TintBadge(icon, error, error.copy(alpha = .12f), 42.dp, 20.dp) else AccentBadge(icon, 42.dp, 20.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = if (destructive) error else MaterialTheme.colorScheme.onSurface)
            if (subtitle.isNotBlank()) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        }
        Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
