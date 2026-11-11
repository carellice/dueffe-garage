package it.dueffe.garage

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Detail page frame: top bar, a header with the type badge, the content and the actions at the bottom. */
@Composable private fun DetailScaffold(
    backLabel: String, onBack: () -> Unit, overline: String, title: String, subtitle: String, appearance: MaintenanceAppearance,
    accent: Color = appearance.tint, actions: @Composable ColumnScope.() -> Unit, content: @Composable ColumnScope.() -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        PageTopBar("", onBack, backLabel)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp).padding(top = 8.dp, bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth().staggerIn(0), verticalAlignment = Alignment.CenterVertically) {
                val pop = remember { Animatable(.6f) }
                LaunchedEffect(Unit) { pop.animateTo(1f, spring(dampingRatio = .55f, stiffness = Spring.StiffnessLow)) }
                Box(Modifier.graphicsLayer { scaleX = pop.value; scaleY = pop.value }) {
                    TintBadge(appearance.icon, accent, accent.copy(alpha = .14f), 60.dp, 28.dp)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Overline(overline, color = accent)
                    Text(title, fontSize = 28.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.6).sp)
                    if (subtitle.isNotBlank()) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                }
            }
            content()
        }
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = actions)
    }
}

/** A spec sheet: label on the left, value on the right, hairlines in between. */
@Composable private fun SpecSheet(rows: List<Pair<String, String>>, modifier: Modifier = Modifier) {
    Panel(modifier.fillMaxWidth().staggerIn(1), padding = 0.dp) {
        rows.forEachIndexed { i, (label, value) ->
            if (i > 0) RowDivider(16.dp)
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(12.dp))
                Text(value, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.End, style = Numeric, modifier = Modifier.weight(1.4f))
            }
        }
    }
}

@Composable private fun NotesPanel(text: String) {
    Panel(Modifier.fillMaxWidth().staggerIn(2), padding = 16.dp) {
        Overline("Note")
        Spacer(Modifier.height(8.dp))
        Text(text, fontSize = 15.sp, lineHeight = 22.sp)
    }
}

@Composable private fun EditDeleteActions(onEdit: () -> Unit, onDelete: () -> Unit, editLabel: String, deleteLabel: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        GhostButton(onClick = onDelete, danger = true, modifier = Modifier.weight(1f)) {
            Icon(painterResource(R.drawable.ic_delete), contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp)); Text(deleteLabel, maxLines = 1)
        }
        AccentButton(onClick = onEdit, modifier = Modifier.weight(1f)) {
            Icon(painterResource(R.drawable.ic_edit), contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp)); Text(editLabel, maxLines = 1)
        }
    }
}

private fun intervalLabel(r: Reminder): String {
    val unit = when {
        r.intervalUnit == "months" && r.intervalValue == 1 -> "mese"
        r.intervalUnit == "months" -> "mesi"
        r.intervalValue == 1 -> "anno"
        else -> "anni"
    }
    return "Ogni ${r.intervalValue} $unit"
}

@Composable internal fun MaintenanceDetailScreen(
    maintenance: Maintenance, reminder: Reminder?, onBack: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit
) {
    val appearance = maintenanceAppearance(maintenance.type)
    DetailScaffold("Auto", onBack, "Intervento", maintenanceLabel(maintenance), "", appearance,
        actions = { EditDeleteActions(onEdit, onDelete, "Modifica", "Elimina") }) {
        Panel(Modifier.fillMaxWidth().staggerIn(1), padding = 16.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Readout("Costo", Modifier.weight(1f)) { AnimatedCount(maintenance.cost, it, format = { v -> euro(v, decimals = true) }) }
                ReadoutDivider()
                Spacer(Modifier.width(14.dp))
                Readout("Chilometri", Modifier.weight(1f)) { AnimatedCount(maintenance.mileage, it) }
            }
        }
        SpecSheet(listOf("Data" to dateLabel(maintenance.date), "Tipo" to appearance.label))
        if (maintenance.notes.isNotBlank()) NotesPanel(maintenance.notes)
        if (reminder != null) {
            Overline("Promemoria attivo", Modifier.padding(start = 4.dp, top = 4.dp))
            SpecSheet(buildList {
                reminder.dueDate.takeIf { it.isNotBlank() }?.let { add("Scadenza" to dateLabel(it)) }
                reminder.mileageThreshold?.let { add("Soglia" to it.formatKm()) }
                if (reminder.type == "interval" && reminder.intervalValue != null) add("Ripetizione" to intervalLabel(reminder))
            })
        }
    }
}

@Composable internal fun ReminderDetailScreen(
    due: DueReminder, onBack: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit
) {
    val appearance = maintenanceAppearance(due.maintenance.type)
    val urgency = urgencyFor(due.days)
    val date = reminderDueDate(due)
    val status = when {
        due.reminder.type == "mileage" && due.kmLeft != null && due.kmLeft <= 0 -> "Da effettuare"
        due.reminder.type == "mileage" && due.kmLeft != null -> "Mancano ${due.kmLeft.formatKm()}"
        due.days == null -> "Da verificare"
        due.days < 0 -> "Scaduta da ${-due.days} giorni"
        due.days == 0L -> "Oggi"
        due.days == 1L -> "Tra 1 giorno"
        else -> "Tra ${due.days} giorni"
    }
    DetailScaffold("Auto", onBack, "Scadenza", maintenanceLabel(due.maintenance), due.vehicle.name, appearance, accent = urgency.color,
        actions = { EditDeleteActions(onEdit, onDelete, "Modifica", "Elimina") }) {
        Panel(Modifier.fillMaxWidth().staggerIn(1), padding = 20.dp) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Gauge(deadlineFraction(due.days), urgency.color, Modifier.size(150.dp), stroke = 8.dp) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        val big = when {
                            due.reminder.type == "mileage" && due.kmLeft != null -> String.format(java.util.Locale.ITALY, "%,d", maxOf(due.kmLeft, 0))
                            due.days != null -> kotlin.math.abs(due.days).toString()
                            else -> "—"
                        }
                        Text(big, fontSize = 38.sp, fontWeight = FontWeight.Bold, color = urgency.color, style = Numeric, letterSpacing = (-1).sp)
                        Text(when { due.reminder.type == "mileage" -> "km"; due.days != null && due.days < 0 -> "giorni fa"; else -> "giorni" },
                            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                }
                Spacer(Modifier.height(8.dp))
                StatusPill(status, urgency.color)
            }
        }
        SpecSheet(buildList {
            if (date.isNotBlank()) add("Data di scadenza" to dateLabel(date))
            due.reminder.mileageThreshold?.let { add("Soglia chilometrica" to it.formatKm()) }
            if (due.reminder.type == "interval" && due.reminder.intervalValue != null) add("Ripetizione" to intervalLabel(due.reminder))
            add("Ultimo intervento" to dateLabel(due.maintenance.date))
            add("Km registrati" to due.maintenance.mileage.formatKm())
        })
        if (due.maintenance.notes.isNotBlank()) NotesPanel(due.maintenance.notes)
    }
}

@Composable internal fun DocumentDetailScreen(
    document: GarageDocument, linked: Maintenance?, onBack: () -> Unit,
    onOpenFile: () -> Unit, onShare: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit
) {
    val category = documentCategory(document, listOfNotNull(linked))
    val appearance = documentAppearance(category)
    DetailScaffold("Auto", onBack, "Documento", document.name, appearance.label, appearance.copy(icon = R.drawable.ic_document), accent = MaterialTheme.colorScheme.primary,
        actions = {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton(onClick = onShare, modifier = Modifier.weight(1f)) {
                    Icon(painterResource(R.drawable.ic_share), contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp)); Text("Condividi")
                }
                AccentButton(onClick = onOpenFile, modifier = Modifier.weight(1f)) { Text("Apri file") }
            }
            EditDeleteActions(onEdit, onDelete, "Modifica", "Elimina")
        }) {
        Box(Modifier.fillMaxWidth().staggerIn(1)) {
            DocumentThumbnail(document, category, Modifier.fillMaxWidth().height(230.dp).bouncyClick(onClickLabel = "Apri file", onClick = onOpenFile), maxPixels = 1200, corner = 20.dp)
        }
        SpecSheet(buildList {
            add("Formato" to documentFormat(document))
            add("Dimensione" to documentSize(document.size))
            add("Aggiunto il" to documentDate(document.addedAt))
            if (linked != null) add("Intervento" to "${maintenanceLabel(linked)} · ${dateLabel(linked.date)}")
        })
    }
}
