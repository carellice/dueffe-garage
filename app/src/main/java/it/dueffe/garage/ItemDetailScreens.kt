package it.dueffe.garage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

@Composable private fun ItemDetailHeader(section: String, title: String, subtitle: String, appearance: MaintenanceAppearance) {
    Text(section.uppercase(Locale.ITALY), color = MaterialTheme.colorScheme.primary, fontSize = 11.sp,
        letterSpacing = 2.sp, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(3.dp))
    Text(title, fontSize = 33.sp, lineHeight = 36.sp, fontWeight = FontWeight.Black, letterSpacing = (-.5).sp)
    Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp)
    Spacer(Modifier.height(6.dp))
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val pop = remember { Animatable(.4f) }
        LaunchedEffect(Unit) { pop.animateTo(1f, spring(dampingRatio = .45f, stiffness = Spring.StiffnessLow)) }
        Box(Modifier.size(62.dp).graphicsLayer { scaleX = pop.value; scaleY = pop.value }.background(appearance.background, CircleShape), contentAlignment = Alignment.Center) {
            Icon(painterResource(appearance.icon), contentDescription = null, tint = appearance.tint, modifier = Modifier.size(31.dp))
        }
        Text(appearance.label, color = appearance.tint, fontWeight = FontWeight.Bold,
            modifier = Modifier.background(appearance.background, RoundedCornerShape(18.dp)).padding(horizontal = 12.dp, vertical = 7.dp))
    }
}

@Composable private fun ItemDetailFact(label: String, value: String, icon: Int) {
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp)) {
        Box(Modifier.size(39.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape), contentAlignment = Alignment.Center) {
            Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(21.dp))
        }
        Column {
            Text(label.uppercase(Locale.ITALY), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, letterSpacing = 1.sp)
            Text(value, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable private fun ItemDetailCard(content: @Composable ColumnScope.() -> Unit) {
    GlassCard(Modifier.fillMaxWidth().staggerIn(2), padding = 17.dp, content = content)
}

@Composable private fun ItemDetailActions(onEdit: () -> Unit, onDelete: () -> Unit, editLabel: String, deleteLabel: String) {
    GradientButton(onClick = onEdit, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp)) {
        Icon(painterResource(R.drawable.ic_edit), contentDescription = null, modifier = Modifier.size(19.dp))
        Spacer(Modifier.width(8.dp))
        Text(editLabel, fontWeight = FontWeight.Bold)
    }
    OutlinedButton(onClick = onDelete, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
        Icon(painterResource(R.drawable.ic_delete), contentDescription = null, modifier = Modifier.size(19.dp))
        Spacer(Modifier.width(8.dp))
        Text(deleteLabel, fontWeight = FontWeight.SemiBold)
    }
}

@Composable internal fun MaintenanceDetailScreen(
    maintenance: Maintenance, reminder: Reminder?, onBack: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit
) {
    val appearance = maintenanceAppearance(maintenance.type)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)) {
        GarageBackButton("Interventi", onBack)
        ItemDetailHeader("Intervento", maintenanceLabel(maintenance), "Dettagli e manutenzione della tua auto", appearance)
        ItemDetailCard {
            ItemDetailFact("Data intervento", dateLabel(maintenance.date), R.drawable.ic_calendar_nav)
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
            ItemDetailFact("Chilometri", maintenance.mileage.formatKm(), R.drawable.ic_speedometer)
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
            ItemDetailFact("Costo", String.format(Locale.ITALY, "€ %,.2f", maintenance.cost), R.drawable.ic_coins)
        }
        if (maintenance.notes.isNotBlank()) ItemDetailCard {
            Text("Note", fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(maintenance.notes, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (reminder != null) ItemDetailCard {
            Text("Promemoria attivo", fontSize = 17.sp, fontWeight = FontWeight.Bold)
            val due = reminder.dueDate.takeIf { it.isNotBlank() }
            if (due != null) ItemDetailFact("Scadenza", dateLabel(due), R.drawable.ic_calendar_nav)
            reminder.mileageThreshold?.let { ItemDetailFact("Soglia chilometrica", it.formatKm(), R.drawable.ic_speedometer) }
        }
        ItemDetailActions(onEdit, onDelete, "Modifica intervento", "Elimina intervento")
    }
}

@Composable internal fun ReminderDetailScreen(
    due: DueReminder, onBack: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit
) {
    val appearance = maintenanceAppearance(due.maintenance.type)
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
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)) {
        GarageBackButton("Scadenze", onBack)
        ItemDetailHeader("Scadenza", maintenanceLabel(due.maintenance), reminderSubtitle(due), appearance)
        ItemDetailCard {
            ItemDetailFact("Stato", status, R.drawable.ic_clock)
            if (date.isNotBlank()) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                ItemDetailFact("Data di scadenza", dateLabel(date), R.drawable.ic_calendar_nav)
            }
            due.reminder.mileageThreshold?.let {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                ItemDetailFact("Soglia chilometrica", it.formatKm(), R.drawable.ic_speedometer)
            }
            if (due.reminder.type == "interval" && due.reminder.intervalValue != null) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                val unit = when {
                    due.reminder.intervalUnit == "months" && due.reminder.intervalValue == 1 -> "mese"
                    due.reminder.intervalUnit == "months" -> "mesi"
                    due.reminder.intervalValue == 1 -> "anno"
                    else -> "anni"
                }
                ItemDetailFact("Intervallo", "Ogni ${due.reminder.intervalValue} $unit", R.drawable.ic_repeat)
            }
        }
        ItemDetailCard {
            Text("Intervento collegato", fontSize = 17.sp, fontWeight = FontWeight.Bold)
            ItemDetailFact("Registrato il", dateLabel(due.maintenance.date), R.drawable.ic_calendar_nav)
            ItemDetailFact("Chilometri registrati", due.maintenance.mileage.formatKm(), R.drawable.ic_speedometer)
        }
        ItemDetailActions(onEdit, onDelete, "Modifica scadenza", "Elimina scadenza")
    }
}

@Composable internal fun DocumentDetailScreen(
    document: GarageDocument, linked: Maintenance?, onBack: () -> Unit,
    onOpenFile: () -> Unit, onShare: () -> Unit, onEdit: () -> Unit, onDelete: () -> Unit
) {
    val category = documentCategory(document, listOfNotNull(linked))
    val appearance = documentAppearance(category)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)) {
        GarageBackButton("Documenti", onBack)
        ItemDetailHeader("Documento", document.name, "Una copia sempre a portata di mano", appearance)
        DocumentThumbnail(document, category, Modifier.fillMaxWidth().height(205.dp), maxPixels = 1200)
        ItemDetailCard {
            ItemDetailFact("Formato", when (document.mimeType) { "application/pdf" -> "PDF"; "image/jpeg" -> "JPG"; "image/png" -> "PNG"; else -> document.mimeType }, R.drawable.ic_document)
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
            ItemDetailFact("Dimensione", documentSize(document.size), R.drawable.ic_document)
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
            ItemDetailFact("Aggiunto il", documentDate(document.addedAt), R.drawable.ic_calendar_nav)
            if (linked != null) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                ItemDetailFact("Intervento collegato", "${maintenanceLabel(linked)} · ${dateLabel(linked.date)}", R.drawable.ic_wrench)
            }
        }
        GradientButton(onClick = onOpenFile, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp)) {
            Text("Apri file", fontWeight = FontWeight.Bold)
        }
        OutlinedButton(onClick = onShare, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp)) {
            Icon(painterResource(R.drawable.ic_share), contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Condividi", fontWeight = FontWeight.SemiBold)
        }
        ItemDetailActions(onEdit, onDelete, "Modifica documento", "Elimina documento")
    }
}
