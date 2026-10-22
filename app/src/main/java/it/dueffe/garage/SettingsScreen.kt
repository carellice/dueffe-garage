package it.dueffe.garage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable internal fun SettingsScreen(
    theme: String, changeTheme: (String) -> Unit, lastChange: String, lastExport: String,
    notifications: Boolean, onNotifications: (Boolean) -> Unit, leadDays: Int, onLeadDays: (Int) -> Unit,
    protection: Boolean, onProtection: (Boolean) -> Unit, hasPin: Boolean, onChangePin: () -> Unit,
    biometric: Boolean, biometricAvailable: Boolean, onBiometric: (Boolean) -> Unit, onLock: () -> Unit,
    onExport: () -> Unit, onImport: () -> Unit, onOnboarding: () -> Unit, onClear: () -> Unit
) {
    var clearConfirm by remember { mutableStateOf(false) }
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val onAccent = if (LocalGarageDark.current) Black else Color.White
    LazyColumn(contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item { SectionHeading("Garage", "Impostazioni", "Il tuo spazio, come piace a te.") }
        item {
            SettingsPanel(R.drawable.ic_settings_nav, "Aspetto", "Scegli come vedere il tuo garage", index = 1) {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.surfaceContainer)
                    .padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf(Triple("system", "Sistema", R.drawable.ic_settings_nav), Triple("light", "Chiaro", R.drawable.ic_calendar_nav), Triple("dark", "Scuro", R.drawable.ic_garage_nav)).forEach { (key, label, icon) ->
                        val selected = theme == key
                        Row(Modifier.weight(1f).clip(RoundedCornerShape(17.dp))
                            .background(if (selected) accentGradient() else Brush.linearGradient(listOf(Color.Transparent, Color.Transparent)))
                            .bouncyClick { changeTheme(key) }.padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                            Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(16.dp),
                                tint = if (selected) onAccent else muted)
                            Spacer(Modifier.width(5.dp))
                            Text(label, color = if (selected) onAccent else muted,
                                fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
                        }
                    }
                }
            }
        }
        item {
            SettingsPanel(R.drawable.ic_calendar_nav, "Scadenze", "Promemoria per arrivare sempre in tempo", index = 2) {
                SettingsSwitchRow("Notifiche", "Avvisami delle prossime scadenze", notifications, onNotifications)
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Preavviso", fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.weight(1f))
                    Text("$leadDays giorni", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                Slider(value = leadDays.toFloat(), onValueChange = { onLeadDays(it.toInt().coerceIn(1, 30)) }, valueRange = 1f..30f,
                    enabled = notifications)
            }
        }
        item {
            SettingsPanel(R.drawable.ic_shield, "Privacy e accesso", "I tuoi dati restano nelle tue mani", index = 3) {
                SettingsSwitchRow("Proteggi Garage", "Richiedi il PIN all'apertura", protection, onProtection)
                if (protection) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                    SettingsSwitchRow("Biometria", if (biometricAvailable) "Usa impronta o volto" else "Non disponibile su questo dispositivo",
                        biometric, onBiometric, enabled = biometricAvailable && hasPin)
                    SettingsAction("Cambia PIN", R.drawable.ic_edit, onChangePin)
                    SettingsAction("Blocca adesso", R.drawable.ic_shield, onLock)
                }
                Text("Il blocco protegge l'accesso all'app; i backup esportati non sono cifrati.", color = muted, fontSize = 12.sp, lineHeight = 17.sp)
            }
        }
        item {
            SettingsPanel(R.drawable.ic_folder, "I tuoi dati", "Esporta o ripristina il tuo archivio", index = 4) {
                val backupStatus = if (lastExport.isBlank()) "Nessun backup esportato" else if (lastChange > lastExport) "Un nuovo backup è consigliato" else "Backup aggiornato"
                Text(backupStatus, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                GradientButton(onClick = onExport, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(24.dp)) { Text("Esporta backup", fontWeight = FontWeight.Bold) }
                OutlinedButton(onClick = onImport, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(24.dp)) { Text("Importa backup") }
                Text("Il file include foto e documenti e non è cifrato.", color = muted, fontSize = 12.sp)
            }
        }
        item {
            SettingsPanel(R.drawable.ic_note, "Garage", "L'archivio è disponibile anche offline", index = 5) {
                SettingsAction("Rivedi l'introduzione", R.drawable.ic_chevron_right, onOnboarding)
            }
        }
        item {
            OutlinedButton(onClick = { clearConfirm = true }, modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(25.dp), colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                Icon(painterResource(R.drawable.ic_delete), contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp)); Text("Elimina tutti i dati")
            }
        }
        item { it.dueffe.updates.AppUpdateCard("garage", it.dueffe.garage.BuildConfig.UPDATE_REPOSITORY) }
    }
    if (clearConfirm) ConfirmDelete("Eliminare definitivamente auto, interventi e documenti?", { clearConfirm = false }, { onClear(); clearConfirm = false })
}

@Composable private fun SettingsPanel(icon: Int, title: String, subtitle: String, index: Int = 0, content: @Composable ColumnScope.() -> Unit) {
    GlassCard(Modifier.fillMaxWidth().staggerIn(index), padding = 0.dp) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                GradientIcon(icon, 46.dp, 22.dp)
                Column {
                    Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .16f))
            content()
        }
    }
}

@Composable private fun SettingsSwitchRow(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit, enabled: Boolean = true) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
        Switch(checked, onCheckedChange, enabled = enabled)
    }
}

@Composable private fun SettingsAction(label: String, icon: Int, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).bouncyClick(onClick = onClick).padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.width(10.dp))
        Text(label, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
