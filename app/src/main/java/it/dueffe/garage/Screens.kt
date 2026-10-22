package it.dueffe.garage

import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.BoundsTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Locale
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val fuelOptions = listOf("Benzina", "Diesel", "GPL", "Benzina/GPL", "Metano", "Benzina/Metano", "Ibrida", "Ibrida plug-in", "Elettrica", "Idrogeno")
private val vehicleTypes = linkedMapOf("car" to "Auto", "motorcycle" to "Moto", "scooter" to "Motorino", "van" to "Furgone", "truck" to "Camion", "camper" to "Camper", "other" to "Altro")
internal fun vehicleTypeLabel(type: String) = vehicleTypes[type] ?: "Altro"

@Composable private fun VehiclePlate(plate: String, type: String, registrationYear: Int, modifier: Modifier = Modifier) {
    val twoWheeler = type == "motorcycle" || type == "scooter"
    val display = plate.uppercase(Locale.ITALY).filterNot(Char::isWhitespace)
    val shape = RoundedCornerShape(7.dp)
    Row(modifier.height(if (twoWheeler) 82.dp else 64.dp).width(if (twoWheeler) 144.dp else 246.dp)
        .border(2.dp, Color(0xFF363636), shape).clip(shape).background(Color(0xFFF9F9F5)), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.fillMaxHeight().width(if (twoWheeler) 24.dp else 31.dp).background(Color(0xFF0755AD)),
            verticalArrangement = Arrangement.SpaceBetween, horizontalAlignment = Alignment.CenterHorizontally) {
            Text("✦", color = Color(0xFFFFDF58), fontSize = 13.sp, lineHeight = 15.sp)
            Text("I", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(3.dp))
        }
        Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
            if (twoWheeler) Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val midpoint = (display.length + 1) / 2
                Text(display.take(midpoint), color = Color(0xFF171717), fontSize = 23.sp, lineHeight = 25.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                Text(display.drop(midpoint), color = Color(0xFF171717), fontSize = 23.sp, lineHeight = 25.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
            } else Text(display, color = Color(0xFF171717), fontSize = if (display.length > 8) 21.sp else 26.sp,
                fontWeight = FontWeight.Black, letterSpacing = 2.sp, maxLines = 1)
        }
        if (!twoWheeler) Column(Modifier.fillMaxHeight().width(24.dp).background(Color(0xFF0755AD)),
            verticalArrangement = Arrangement.SpaceBetween, horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(3.dp)); Text((registrationYear % 100).toString().padStart(2, '0'), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text("◌", color = Color.White, fontSize = 13.sp); Spacer(Modifier.height(3.dp))
        }
    }
}

@Composable internal fun GarageBackButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    FilledTonalButton(onClick = onClick, modifier = modifier, shape = RoundedCornerShape(24.dp), contentPadding = PaddingValues(horizontal = 15.dp, vertical = 9.dp)) {
        Icon(painterResource(R.drawable.ic_arrow_back), contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(7.dp))
        Text(label, fontWeight = FontWeight.SemiBold)
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable internal fun VehicleDetail(
    v: Vehicle, state: GarageState, tab: String, setTab: (String) -> Unit,
    sectionsPage: Boolean, onClose: () -> Unit, onOpenSections: () -> Unit,
    onEdit: () -> Unit, onStatus: () -> Unit, onDelete: () -> Unit,
    onAddMaintenance: () -> Unit, onEditMaintenance: (Maintenance) -> Unit, onDeleteMaintenance: (Maintenance) -> Unit,
    onOpenMaintenance: (Maintenance) -> Unit, onOpenReminder: (DueReminder) -> Unit,
    onAddDocument: () -> Unit, onOpenDocument: (GarageDocument) -> Unit, onShareDocument: (GarageDocument) -> Unit, onRenameDocument: (GarageDocument) -> Unit, onDeleteDocument: (GarageDocument) -> Unit,
    onNotes: (String) -> Unit, onCopyPlate: () -> Unit, backLabel: String = "Garage",
    sharedTransitionScope: SharedTransitionScope? = null, animatedVisibilityScope: AnimatedVisibilityScope? = null
) {
    val maintenances = state.maintenances.filter { it.vehicleId == v.id }
    val docs = state.documents.filter { it.vehicleId == v.id }
    val reminders = dueReminders(state).filter { it.vehicle.id == v.id }
    var query by remember(v.id, tab) { mutableStateOf("") }
    var typeFilter by remember(v.id) { mutableStateOf("all") }
    var documentFilter by remember(v.id) { mutableStateOf("all") }
    var reminderFilter by remember(v.id) { mutableStateOf("all") }
    var notes by remember(v.id, v.notes) { mutableStateOf(v.notes) }
    val accent = MaterialTheme.colorScheme.primary
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val statusLabel = when (v.status) { "sold" -> "Venduta"; "scrapped" -> "Rottamata"; else -> "Attiva" }
    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (!sectionsPage) item {
            Box(Modifier.fillMaxWidth().height(if (v.photo != null) 250.dp else 72.dp)) {
                if (v.photo != null) {
                    val photoModifier = Modifier.fillMaxSize()
                    VehicleImage(v.photo, photoModifier.clip(RoundedCornerShape(28.dp)))
                    Box(Modifier.matchParentSize().clip(RoundedCornerShape(28.dp)).background(Brush.verticalGradient(0f to Color.Black.copy(alpha = .35f), .3f to Color.Transparent, .7f to Color.Transparent, 1f to Color.Black.copy(alpha = .35f))))
                }
                val backModifier = Modifier
                GarageBackButton(backLabel, onClose, Modifier.align(Alignment.TopStart).padding(12.dp).then(backModifier))
            }
        }
        if (sectionsPage) item { GarageBackButton("Dettaglio auto", onClose) }
        item { Column(Modifier.padding(horizontal = 2.dp, vertical = 2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(18.dp).height(3.dp).clip(CircleShape).background(accentGradient()))
                Spacer(Modifier.width(8.dp))
                Text(if (sectionsPage) "DIARIO" else "LA TUA AUTO", color = accent, fontSize = 11.sp, letterSpacing = 2.4.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(4.dp))
            val titleModifier = Modifier
            Text(if (sectionsPage) "La vita della tua auto" else v.name, modifier = titleModifier, fontSize = 34.sp, lineHeight = 37.sp, fontWeight = FontWeight.Black, letterSpacing = (-.6).sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(if (sectionsPage) "${v.name} · Interventi, scadenze, documenti e note" else "${v.make} ${v.model}".trim(), color = muted, fontSize = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        } }
        if (!sectionsPage) item {
            GlassCard(Modifier.fillMaxWidth(), padding = 0.dp) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 15.dp)) {
                VehiclePlate(v.plate, v.vehicleType, v.registrationDate.take(4).toIntOrNull() ?: v.year, Modifier.align(Alignment.CenterHorizontally))
                Spacer(Modifier.height(16.dp)); HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .17f)); Spacer(Modifier.height(13.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    DetailFact("TIPO", vehicleTypeLabel(v.vehicleType), R.drawable.ic_car, Modifier.weight(1f))
                    VerticalDivider(Modifier.height(45.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                    DetailFact("ANNO", v.year.toString(), R.drawable.ic_calendar_nav, Modifier.weight(1f))
                }
                Spacer(Modifier.height(13.dp)); HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .17f)); Spacer(Modifier.height(13.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                        DetailFact("CHILOMETRI", v.mileage.formatKm(), R.drawable.ic_speedometer)
                        DetailFact("IMMATRICOLATA", if (v.registrationDate.isBlank()) "Non indicata" else dateLabel(v.registrationDate), R.drawable.ic_calendar_nav)
                    }
                    VerticalDivider(Modifier.height(100.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(15.dp)) {
                        DetailFact("STATO", statusLabel, R.drawable.ic_car, statusDot = v.status == "active")
                        DetailFact("CARBURANTE", v.fuel.ifBlank { "Non indicato" }, R.drawable.ic_fuel)
                    }
                }
                Spacer(Modifier.height(15.dp)); HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .17f)); Spacer(Modifier.height(13.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    DetailAction("Copia targa", R.drawable.ic_copy, onCopyPlate, Modifier.weight(1f))
                    DetailAction("Modifica", R.drawable.ic_edit, onEdit, Modifier.weight(1f))
                    DetailAction("Stato", R.drawable.ic_car, onStatus, Modifier.weight(1f))
                    DetailAction("Elimina auto", R.drawable.ic_delete, onDelete, Modifier.weight(1f), destructive = true)
                }
            }
            }
        }
        if (!sectionsPage) item { GradientButton(onClick = onOpenSections, modifier = Modifier.fillMaxWidth().height(56.dp).then(
            if (sharedTransitionScope != null && animatedVisibilityScope != null) Modifier.containerTransform("sections-page-${v.id}", sharedTransitionScope, animatedVisibilityScope) else Modifier), shape = RoundedCornerShape(28.dp), shine = true) {
            Icon(painterResource(R.drawable.ic_wrench), contentDescription = null, modifier = Modifier.size(21.dp))
            Spacer(Modifier.width(9.dp)); Text("Interventi, scadenze, documenti e note", fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1)
        } }
        if (sectionsPage) item {
            val sections = listOf("Interventi" to R.drawable.ic_wrench, "Scadenze" to R.drawable.ic_calendar_nav, "Documenti" to R.drawable.ic_document, "Note" to R.drawable.ic_note)
            BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(32.dp)).background(MaterialTheme.colorScheme.surface).border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .18f), RoundedCornerShape(32.dp)).padding(3.dp)) {
                val segmentWidth = maxWidth / sections.size
                val indicatorX by animateDpAsState(segmentWidth * sections.indexOfFirst { it.first == tab }.coerceAtLeast(0), spring(dampingRatio = .7f, stiffness = Spring.StiffnessMediumLow), label = "scheda_selezionata")
                Box(Modifier.offset(x = indicatorX).width(segmentWidth).height(43.dp).clip(RoundedCornerShape(28.dp)).background(accentGradient()))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    sections.forEach { (label, icon) ->
                        val isSelected = tab == label
                        val onAccent = if (LocalGarageDark.current) Black else Color.White
                        val textColor by animateColorAsState(if (isSelected) onAccent else muted, tween(260), label = "colore_$label")
                        val iconColor by animateColorAsState(if (isSelected) onAccent else accent, tween(260), label = "icona_$label")
                        Row(Modifier.weight(1f).height(43.dp).clip(RoundedCornerShape(28.dp)).clickable(role = Role.Tab) { setTab(label) }, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                            Icon(painterResource(icon), contentDescription = null, tint = iconColor, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(label, fontSize = 10.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium, color = textColor, maxLines = 1)
                        }
                    }
                }
            }
        }
        if (sectionsPage) when (tab) {
            "Interventi" -> {
                item(key = "interventi-add") { Box(Modifier.animateItem()) { GradientButton(onClick = onAddMaintenance, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp)) { Text("＋", fontSize = 24.sp); Spacer(Modifier.width(8.dp)); Text("Registra intervento", fontWeight = FontWeight.Bold) } } }
                if (maintenances.isNotEmpty()) {
                    item(key = "interventi-search") { Box(Modifier.animateItem()) { OutlinedTextField(query, { query = it }, placeholder = { Text("Cerca interventi") }, leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null, modifier = Modifier.size(22.dp)) }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(17.dp)) } }
                    item(key = "interventi-filters") { Box(Modifier.animateItem()) { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        listOf("all", "service", "inspection", "tax", "insurance", "tires", "custom").forEach { value ->
                            MaintenanceFilterPill(value, typeFilter == value) { typeFilter = value }
                        }
                    } } }
                }
                val filtered = maintenances.filter { (typeFilter == "all" || it.type == typeFilter) && "${maintenanceLabel(it)} ${it.notes} ${it.date}".contains(query, true) }
                if (filtered.isEmpty()) item(key = "interventi-empty") { Box(Modifier.animateItem()) {
                    if (maintenances.isEmpty()) DetailEmptyState("Nessun intervento registrato.", "Registra il primo intervento per tenere traccia della manutenzione della tua auto.")
                    else DetailEmptyState("Nessun intervento trovato.", "Prova un'altra ricerca o seleziona un altro filtro.")
                } }
                items(filtered, key = { "maintenance-${it.id}" }) { m -> Box(Modifier.animateItem()) { MaintenanceListCard(
                    maintenance = m, onOpen = { onOpenMaintenance(m) }
                ) } }
            }
            "Scadenze" -> {
                if (reminders.isNotEmpty()) item(key = "scadenze-filters") { Box(Modifier.animateItem()) { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("all", "service", "inspection", "tax", "insurance", "tires", "custom").forEach { type ->
                        ReminderFilterPill(type, reminderFilter == type) { reminderFilter = type }
                    }
                } } }
                val filteredReminders = reminders.filter { reminderFilter == "all" || it.maintenance.type == reminderFilter }
                if (filteredReminders.isEmpty()) item(key = "scadenze-empty") { Box(Modifier.animateItem()) {
                    if (reminders.isEmpty()) DetailEmptyState("Nessuna scadenza attiva.", "Le prossime scadenze della tua auto compariranno qui.")
                    else DetailEmptyState("Nessuna scadenza trovata.", "Seleziona un altro filtro per vedere le scadenze.")
                } }
                items(filteredReminders, key = { "reminder-${it.reminder.id}" }) { r -> Box(Modifier.animateItem()) { ReminderListCard(r) { onOpenReminder(r) } } }
            }
            "Documenti" -> {
                item(key = "documenti-add") { Box(Modifier.animateItem()) { GradientButton(onClick = onAddDocument, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp)) { Text("＋", fontSize = 24.sp); Spacer(Modifier.width(8.dp)); Text("Aggiungi documento", fontWeight = FontWeight.Bold) } } }
                if (docs.isNotEmpty()) item(key = "documenti-search") { Box(Modifier.animateItem()) { OutlinedTextField(query, { query = it }, placeholder = { Text("Cerca documenti") }, leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null, modifier = Modifier.size(22.dp)) }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(17.dp)) } }
                if (docs.isNotEmpty()) item(key = "documenti-filters") { Box(Modifier.animateItem()) { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("all", "insurance", "inspection", "tax", "service", "other").forEach { category ->
                        DocumentFilterPill(category, documentFilter == category) { documentFilter = category }
                    }
                } } }
                val filtered = docs.filter { d ->
                    d.name.contains(query, true) && (documentFilter == "all" || documentCategory(d, state.maintenances) == documentFilter)
                }.sortedByDescending { it.addedAt }
                if (filtered.isEmpty()) item(key = "documenti-empty") { Box(Modifier.animateItem()) {
                    if (docs.isEmpty()) DetailEmptyState("Nessun documento salvato.", "Aggiungi libretto, assicurazione e altri documenti della tua auto.")
                    else DetailEmptyState("Nessun documento trovato.", "Prova un'altra ricerca o seleziona un altro filtro.")
                } }
                items(filtered, key = { "document-${it.id}" }) { d -> Box(Modifier.animateItem()) { DocumentListCard(
                    d, documentCategory(d, state.maintenances),
                    onOpen = { onOpenDocument(d) }, onShare = { onShareDocument(d) },
                    onRename = { onRenameDocument(d) }, onDelete = { onDeleteDocument(d) }
                ) } }
            }
            else -> item(key = "note-card") { Box(Modifier.animateItem()) { GarageNotesCard(v.notesUpdatedAt, notes, { notes = it }) { onNotes(notes) } } }
        }
    }
}

private fun notesUpdatedLabel(value: String): String = if (value.isBlank()) "Mai" else runCatching {
    dateLabel(Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate().toString())
}.getOrDefault(value)

@Composable private fun NotesUpdatedBadge(updatedAt: String) {
    Row(
        Modifier.clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Icon(painterResource(R.drawable.ic_clock), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
        Text("Ultima modifica: ${notesUpdatedLabel(updatedAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, maxLines = 1)
    }
}

@Composable private fun GarageNotesCard(updatedAt: String, value: String, onValueChange: (String) -> Unit, onSave: () -> Unit) {
    val requester = remember { BringIntoViewRequester() }
    var focused by remember { mutableStateOf(false) }
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    LaunchedEffect(focused, imeBottom) { if (focused && imeBottom > 0) requester.bringIntoView() }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(MaterialTheme.colorScheme.surface)
            .padding(18.dp), verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val heading: @Composable () -> Unit = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    GradientIcon(R.drawable.ic_note, 56.dp, 27.dp)
                    Column {
                        Text("Appunti", fontSize = 27.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black)
                        Text("Note e promemoria sulla tua auto.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                }
            }
            if (maxWidth >= 560.dp) Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { heading() }
                NotesUpdatedBadge(updatedAt)
            } else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                heading()
                NotesUpdatedBadge(updatedAt)
            }
        }
        OutlinedTextField(
            value = value, onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().height(210.dp).bringIntoViewRequester(requester)
                .onFocusChanged { focused = it.isFocused },
            placeholder = { Text("Scrivi le tue note sull'auto...", color = MaterialTheme.colorScheme.onSurfaceVariant) },
            shape = RoundedCornerShape(16.dp), minLines = 6,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline
            )
        )
        GradientButton(onClick = onSave, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(28.dp)) {
            Text("Salva note", fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
    }
}

internal data class MaintenanceAppearance(val label: String, val icon: Int, val tint: Color, val background: Color)

private fun appearance(label: String, icon: Int, tint: Color, background: Color, darkTint: Color, dark: Boolean) =
    if (dark) MaintenanceAppearance(label, icon, darkTint, darkTint.copy(alpha = .16f)) else MaintenanceAppearance(label, icon, tint, background)

@Composable internal fun maintenanceAppearance(type: String): MaintenanceAppearance {
    val dark = LocalGarageDark.current
    return when (type) {
        "service" -> appearance("Tagliando", R.drawable.ic_wrench, Color(0xFF1B5A8A), Color(0xFFE5F0FF), Color(0xFF7DB8FF), dark)
        "inspection" -> appearance("Revisione", R.drawable.ic_settings_nav, Color(0xFF15703F), Color(0xFFE0F5E6), Color(0xFF6FE0A0), dark)
        "tax" -> appearance("Bollo", R.drawable.ic_receipt, Color(0xFFB4530B), Color(0xFFFFEAD6), Color(0xFFFFA45C), dark)
        "insurance" -> appearance("Assicurazione", R.drawable.ic_shield, Color(0xFF8A5C00), Color(0xFFFFF0CC), Color(0xFFFFD84D), dark)
        "tires" -> appearance("Cambio gomme", R.drawable.ic_tire, Color(0xFF7B2D8E), Color(0xFFF3E6FA), Color(0xFFD69CFF), dark)
        else -> appearance("Altro", R.drawable.ic_more, Color(0xFF66563C), Color(0xFFF1ECE3), Color(0xFFCDBB98), dark)
    }
}

@Composable private fun ReminderFilterPill(type: String, selected: Boolean, onClick: () -> Unit) {
    val appearance = maintenanceAppearance(type)
    val shape = RoundedCornerShape(13.dp)
    Row(
        Modifier.height(43.dp).clip(shape)
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.outline.copy(alpha = .38f), shape)
            .bouncyClick(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (type != "all") Icon(painterResource(appearance.icon), contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        Text(if (type == "all") "Tutte" else appearance.label, fontSize = 13.sp,
            color = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
    }
}

internal fun reminderDueDate(item: DueReminder): String = if (item.reminder.type == "interval" && item.reminder.intervalValue != null) {
    runCatching {
        val original = LocalDate.parse(item.maintenance.date)
        val count = item.reminder.intervalValue.toLong()
        (if (item.reminder.intervalUnit == "months") original.plusMonths(count) else original.plusYears(count)).toString()
    }.getOrDefault(item.reminder.dueDate)
} else item.reminder.dueDate

internal fun reminderSubtitle(item: DueReminder): String {
    if (item.maintenance.notes.isNotBlank()) return item.maintenance.notes.lineSequence().first()
    val reminder = item.reminder
    if (reminder.type == "interval" && reminder.intervalValue != null) {
        val unit = when {
            reminder.intervalUnit == "months" && reminder.intervalValue == 1 -> "mese"
            reminder.intervalUnit == "months" -> "mesi"
            reminder.intervalValue == 1 -> "anno"
            else -> "anni"
        }
        return "Ogni ${reminder.intervalValue} $unit"
    }
    return when (item.maintenance.type) {
        "service" -> "Manutenzione programmata"
        "inspection" -> "Scadenza revisione"
        "tax" -> "Pagamento bollo"
        "insurance" -> "Rinnovo polizza"
        "tires" -> "Controllo pneumatici"
        else -> "Promemoria per la tua auto"
    }
}

internal fun reminderStatus(item: DueReminder): String {
    val remaining = item.days
    return when {
        item.reminder.type == "mileage" && item.kmLeft != null && item.kmLeft <= 0 -> "Da effettuare"
        item.reminder.type == "mileage" && item.kmLeft != null -> "Tra ${item.kmLeft.formatKm()}"
        remaining == null -> "Da verificare"
        remaining < 0 -> "Scaduta"
        remaining == 0L -> "Oggi"
        remaining == 1L -> "Tra 1 giorno"
        else -> "Tra $remaining giorni"
    }
}

@Composable internal fun ReminderListCard(item: DueReminder, modifier: Modifier = Modifier, showVehicle: Boolean = false, onClick: () -> Unit) {
    val appearance = maintenanceAppearance(item.maintenance.type)
    val dueDate = reminderDueDate(item)
    val status = reminderStatus(item)
    val urgency = urgencyFor(item.days)
    val statusTint = urgency.color
    val statusBackground = urgency.color.copy(alpha = .14f)
    val pulse = rememberInfiniteTransition(label = "urgent")
    val glow by pulse.animateFloat(.35f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "urgent_glow")
    val urgent = (item.days ?: Long.MAX_VALUE) < 0
    val shape = RoundedCornerShape(22.dp)
    Row(
        modifier.fillMaxWidth().clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (urgent) statusTint.copy(alpha = .25f + .35f * glow) else MaterialTheme.colorScheme.outline.copy(alpha = .1f), shape)
            .bouncyClick(onClickLabel = "Apri scadenza ${appearance.label}", onClick = onClick)
            .drawBehind { drawRect(statusTint, size = Size(4.dp.toPx(), size.height)) }
            .padding(start = 16.dp, end = 12.dp, top = 13.dp, bottom = 13.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(Modifier.size(54.dp).background(appearance.background, CircleShape), contentAlignment = Alignment.Center) {
            Icon(painterResource(appearance.icon), contentDescription = null, tint = appearance.tint, modifier = Modifier.size(27.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            if (showVehicle) Text(item.vehicle.name.uppercase(Locale.ITALY), color = MaterialTheme.colorScheme.primary, fontSize = 10.sp,
                letterSpacing = 1.5.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            else Text(appearance.label, modifier = Modifier.clip(RoundedCornerShape(15.dp)).background(appearance.background)
                .padding(horizontal = 9.dp, vertical = 2.dp), color = appearance.tint, fontSize = 11.sp,
                fontWeight = FontWeight.Bold, maxLines = 1)
            Text(when (item.maintenance.type) { "service" -> "Tagliando periodico"; "tax" -> "Bollo auto"; else -> maintenanceLabel(item.maintenance) },
                fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(reminderSubtitle(item), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                if (dueDate.isNotBlank()) {
                    Icon(painterResource(R.drawable.ic_calendar_nav), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                    Text(dateLabel(dueDate), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
                }
                if (item.kmLeft != null && item.reminder.type != "mileage") {
                    Text("·", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    Icon(painterResource(R.drawable.ic_speedometer), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                    Text("${item.reminder.mileageThreshold?.formatKm() ?: ""}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
                } else if (item.reminder.type == "mileage" && item.reminder.mileageThreshold != null) {
                    Icon(painterResource(R.drawable.ic_speedometer), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                    Text(item.reminder.mileageThreshold.formatKm(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
                }
            }
        }
        Row(Modifier.clip(RoundedCornerShape(24.dp)).background(statusBackground)
            .padding(horizontal = 9.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(painterResource(R.drawable.ic_clock), contentDescription = null, tint = statusTint, modifier = Modifier.size(15.dp))
            Text(status, color = statusTint, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

@Composable private fun MaintenanceFilterPill(type: String, selected: Boolean, onClick: () -> Unit) {
    val appearance = maintenanceAppearance(type)
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier.height(43.dp).clip(shape)
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.outline.copy(alpha = .38f), shape)
            .bouncyClick(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (type != "all") Icon(painterResource(appearance.icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(19.dp))
        Text(if (type == "all") "Tutti" else appearance.label, fontSize = 13.sp,
            color = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
    }
}

internal fun documentCategory(document: GarageDocument, maintenances: List<Maintenance>): String {
    maintenances.firstOrNull { it.id == document.maintenanceId }?.type?.let { type ->
        return if (type in listOf("insurance", "inspection", "tax", "service")) type else "other"
    }
    val name = document.name.lowercase(Locale.ITALY)
    return when {
        "assicur" in name || "polizza" in name -> "insurance"
        "revision" in name -> "inspection"
        "bollo" in name || "tassa" in name -> "tax"
        "tagliando" in name || "manutenz" in name -> "service"
        else -> "other"
    }
}

@Composable internal fun documentAppearance(category: String) = when (category) {
    "insurance", "inspection", "tax", "service" -> maintenanceAppearance(category)
    else -> maintenanceAppearance("tires").copy(label = "Altro", icon = R.drawable.ic_more)
}

@Composable private fun DocumentFilterPill(category: String, selected: Boolean, onClick: () -> Unit) {
    val appearance = documentAppearance(category)
    val shape = RoundedCornerShape(13.dp)
    Row(
        Modifier.height(43.dp).clip(shape)
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.outline.copy(alpha = .38f), shape)
            .bouncyClick(onClick = onClick).padding(horizontal = 13.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(painterResource(if (category == "all") R.drawable.ic_folder else appearance.icon), contentDescription = null,
            tint = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp))
        Text(if (category == "all") "Tutti" else appearance.label, fontSize = 13.sp,
            color = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
    }
}

internal fun documentSize(size: Int): String = if (size >= 1_000_000) {
    String.format(Locale.ITALY, "%.1f MB", size / 1_000_000.0)
} else "${(size + 999) / 1000} KB"

internal fun documentDate(timestamp: String): String = runCatching {
    dateLabel(Instant.parse(timestamp).atZone(ZoneId.systemDefault()).toLocalDate().toString())
}.getOrDefault(timestamp.take(10))

@Composable internal fun DocumentThumbnail(document: GarageDocument, category: String, modifier: Modifier = Modifier.size(72.dp), maxPixels: Int = 320) {
    val context = LocalContext.current
    val preview by produceState<Bitmap?>(initialValue = null, document.id, document.updatedAt) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                when {
                    document.mimeType.startsWith("image/") -> {
                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(document.data, 0, document.data.size, bounds)
                        var sample = 1
                        while (bounds.outWidth / sample > maxPixels || bounds.outHeight / sample > maxPixels) sample *= 2
                        BitmapFactory.decodeByteArray(document.data, 0, document.data.size,
                            BitmapFactory.Options().apply { inSampleSize = sample })
                    }
                    document.mimeType == "application/pdf" -> {
                        val temp = File.createTempFile("garage-preview-", ".pdf", context.cacheDir)
                        try {
                            temp.writeBytes(document.data)
                            ParcelFileDescriptor.open(temp, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
                                PdfRenderer(fd).use { renderer ->
                                    renderer.openPage(0).use { page ->
                                        val width = maxPixels
                                        val height = (width.toFloat() * page.height / page.width).toInt().coerceIn(100, maxPixels * 2)
                                        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { bitmap ->
                                            bitmap.eraseColor(android.graphics.Color.WHITE)
                                            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                        }
                                    }
                                }
                            }
                        } finally { temp.delete() }
                    }
                    else -> null
                }
            }.getOrNull()
        }
    }
    Box(modifier.clip(RoundedCornerShape(13.dp)).background(documentAppearance(category).background), contentAlignment = Alignment.Center) {
        if (preview != null) Image(preview!!.asImageBitmap(), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Icon(painterResource(R.drawable.ic_document), contentDescription = null, tint = documentAppearance(category).tint, modifier = Modifier.size(32.dp))
    }
}

@Composable private fun DocumentListCard(
    document: GarageDocument, category: String, onOpen: () -> Unit, onShare: () -> Unit,
    onRename: () -> Unit, onDelete: () -> Unit
) {
    val appearance = documentAppearance(category)
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(MaterialTheme.colorScheme.surface)
            .bouncyClick(onClickLabel = "Apri ${document.name}", onClick = onOpen)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        DocumentThumbnail(document, category)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(appearance.label, modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(appearance.background)
                .padding(horizontal = 9.dp, vertical = 2.dp), color = appearance.tint, fontSize = 11.sp,
                fontWeight = FontWeight.Bold, maxLines = 1)
            Text(document.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val format = when (document.mimeType) { "application/pdf" -> "PDF"; "image/jpeg" -> "JPG"; "image/png" -> "PNG"; else -> document.name.substringAfterLast('.', "FILE").uppercase(Locale.ITALY) }
            Text("$format · ${documentSize(document.size)}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Icon(painterResource(R.drawable.ic_calendar_nav), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(15.dp))
                Text(documentDate(document.addedAt), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Box {
                IconButton(onClick = { menuOpen = true }, modifier = Modifier.size(40.dp)) {
                    Icon(painterResource(R.drawable.ic_more), contentDescription = "Altre azioni", modifier = Modifier.size(20.dp))
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(text = { Text("Rinomina") }, onClick = { menuOpen = false; onRename() })
                    DropdownMenuItem(text = { Text("Elimina") }, onClick = { menuOpen = false; onDelete() })
                }
            }
            TextButton(onClick = onShare, contentPadding = PaddingValues(horizontal = 0.dp)) {
                Icon(painterResource(R.drawable.ic_share), contentDescription = null, modifier = Modifier.size(19.dp))
                Spacer(Modifier.width(4.dp))
                Text("Condividi", fontSize = 12.sp)
            }
        }
    }
}

@Composable private fun MaintenanceListCard(
    maintenance: Maintenance, onOpen: () -> Unit
) {
    val appearance = maintenanceAppearance(maintenance.type)
    val title = when (maintenance.type) {
        "inspection" -> "Revisione periodica"
        "tax" -> "Bollo auto"
        else -> maintenanceLabel(maintenance)
    }
    val shape = RoundedCornerShape(22.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(MaterialTheme.colorScheme.surface)
            .bouncyClick(onClickLabel = "Apri dettaglio intervento", onClick = onOpen)
            .padding(horizontal = 15.dp, vertical = 14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(58.dp).background(appearance.background, CircleShape), contentAlignment = Alignment.Center) {
                Icon(painterResource(appearance.icon), contentDescription = null, tint = appearance.tint, modifier = Modifier.size(31.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(appearance.label, modifier = Modifier.clip(RoundedCornerShape(18.dp)).background(appearance.background)
                        .padding(horizontal = 10.dp, vertical = 3.dp), color = appearance.tint,
                        fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    Spacer(Modifier.weight(1f))
                    Text(String.format(Locale.ITALY, "€ %,.2f", maintenance.cost), fontSize = 16.sp,
                        fontWeight = FontWeight.Black, maxLines = 1)
                }
                Text(title, fontSize = 17.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Icon(painterResource(R.drawable.ic_calendar_nav), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                    Text(dateLabel(maintenance.date), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
                    Text("·", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                    Icon(painterResource(R.drawable.ic_speedometer), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                    Text(maintenance.mileage.formatKm(), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
                }
                if (maintenance.notes.isNotBlank()) Text(maintenance.notes.lineSequence().first(), color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .72f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable private fun DetailFact(label: String, value: String, icon: Int, modifier: Modifier = Modifier, statusDot: Boolean = false) {
    Row(modifier.padding(horizontal = 5.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(34.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape), contentAlignment = Alignment.Center) {
            Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(9.dp))
        Column {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, lineHeight = 13.sp, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (statusDot) { Box(Modifier.size(7.dp).background(Color(0xFF17C977), CircleShape)); Spacer(Modifier.width(5.dp)) }
                Text(value, fontSize = 14.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable private fun DetailAction(label: String, icon: Int, onClick: () -> Unit, modifier: Modifier = Modifier, destructive: Boolean = false) {
    val color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Column(modifier.clip(RoundedCornerShape(15.dp)).bouncyClick(onClick = onClick).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(38.dp).background(if (destructive) color.copy(alpha = .1f) else MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape), contentAlignment = Alignment.Center) {
            Icon(painterResource(icon), contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.height(5.dp))
        Text(label, color = if (destructive) color else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable private fun DetailEmptyState(title: String, subtitle: String) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(23.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            GradientIcon(R.drawable.ic_document, 56.dp, 27.dp)
            Spacer(Modifier.height(9.dp))
            Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, lineHeight = 16.sp, textAlign = TextAlign.Center)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun DocumentEditor(
    uri: Uri?, name: String, error: String,
    existing: GarageDocument?,
    maintenances: List<Maintenance>, linkedMaintenanceId: String?, onLinkMaintenanceChange: (String?) -> Unit,
    onNameChange: (String) -> Unit, onCamera: () -> Unit, onGallery: () -> Unit, onFile: () -> Unit,
    onDismiss: () -> Unit, onSave: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        GarageBackButton("Diario auto", onDismiss)
        SectionHeading("Documenti", if (existing == null) "Nuovo documento" else "Modifica documento", "Conserva una copia accessibile anche offline.")
        InfoCard(Modifier.fillMaxWidth()) {
            Text("Scegli il file", fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text("PDF, immagini e altri file fino a 10 MB. Il documento resta sul dispositivo.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            Spacer(Modifier.height(15.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onCamera, modifier = Modifier.weight(1f)) { Text("Fotocamera", fontSize = 12.sp) }
                OutlinedButton(onClick = onGallery, modifier = Modifier.weight(1f)) { Text("Galleria", fontSize = 12.sp) }
            }
            OutlinedButton(onClick = onFile, modifier = Modifier.fillMaxWidth()) { Text(if (uri == null && existing == null) "Scegli PDF o file" else "Cambia file") }
            if (uri != null) { Spacer(Modifier.height(8.dp)); Text("File selezionato: ${uri.lastPathSegment?.substringAfterLast('/') ?: "Pronto"}", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis) }
            else if (existing != null) { Spacer(Modifier.height(8.dp)); Text("File attuale: ${existing.name}", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis) }
        }
        OutlinedTextField(name, onNameChange, label = { Text("Nome documento *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        var interventionsExpanded by remember { mutableStateOf(false) }
        ExposedDropdownMenuBox(expanded = interventionsExpanded, onExpandedChange = { interventionsExpanded = it }) {
            val linked = maintenances.firstOrNull { it.id == linkedMaintenanceId }
            OutlinedTextField(
                value = linked?.let { "${maintenanceLabel(it)} · ${dateLabel(it.date)}" } ?: "Nessun intervento",
                onValueChange = {}, readOnly = true, singleLine = true,
                label = { Text("Collega a un intervento (facoltativo)") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(interventionsExpanded) },
                modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
            )
            ExposedDropdownMenu(expanded = interventionsExpanded, onDismissRequest = { interventionsExpanded = false }) {
                DropdownMenuItem(text = { Text("Nessun intervento") }, onClick = { onLinkMaintenanceChange(null); interventionsExpanded = false })
                maintenances.forEach { maintenance ->
                    DropdownMenuItem(
                        text = { Text("${maintenanceLabel(maintenance)} · ${dateLabel(maintenance.date)}") },
                        onClick = { onLinkMaintenanceChange(maintenance.id); interventionsExpanded = false }
                    )
                }
            }
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Annulla") }
            GradientButton(onClick = onSave, modifier = Modifier.weight(1f)) { Text("Salva documento") }
        }
    }
}

@Composable internal fun VehicleEditor(existing: Vehicle?, photoUri: Uri?, pickPhoto: () -> Unit, onDismiss: () -> Unit, onSave: (Vehicle) -> Unit, repo: GarageRepository) {
    var name by remember(existing?.id) { mutableStateOf(existing?.name ?: "") }
    var make by remember(existing?.id) { mutableStateOf(existing?.make ?: "") }
    var model by remember(existing?.id) { mutableStateOf(existing?.model ?: "") }
    var year by remember(existing?.id) { mutableStateOf((existing?.year ?: LocalDate.now().year).toString()) }
    var plate by remember(existing?.id) { mutableStateOf(existing?.plate ?: "") }
    var mileage by remember(existing?.id) { mutableStateOf(existing?.mileage?.toString() ?: "") }
    var registration by remember(existing?.id) { mutableStateOf(existing?.registrationDate ?: "") }
    var vehicleType by remember(existing?.id) { mutableStateOf(existing?.vehicleType ?: "car") }
    var fuelChoice by remember(existing?.id) { mutableStateOf(existing?.fuel?.let { if (it in fuelOptions || it.isBlank()) it else "Altro" } ?: "") }
    var customFuel by remember(existing?.id) { mutableStateOf(existing?.fuel?.takeIf { it.isNotBlank() && it !in fuelOptions } ?: "") }
    var error by remember(existing?.id) { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp).padding(top = 17.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Column(Modifier.padding(bottom = 10.dp)) {
            Text("SCHEDA AUTO", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(3.dp))
            Text(if (existing == null) "Nuova auto" else "Modifica auto", fontSize = 33.sp, lineHeight = 36.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(5.dp))
            Text("I dettagli della tua auto, sempre a portata di mano.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp, lineHeight = 20.sp)
        }
        VehiclePhotoField(photoUri, existing?.photo, pickPhoto)
        Spacer(Modifier.height(1.dp))
        VehicleTextField(name, { name = it; error = "" }, "Nome auto *", "Es. La mia auto", R.drawable.ic_car, Modifier.fillMaxWidth())
        VehicleTextField(make, { make = it; error = "" }, "Marca *", "Es. Volkswagen", R.drawable.ic_shield, Modifier.fillMaxWidth())
        VehicleTextField(model, { model = it }, "Modello", "Es. UP", R.drawable.ic_layers, Modifier.fillMaxWidth())
        VehicleSelectionField("Tipo veicolo *", vehicleTypeLabel(vehicleType), "Seleziona tipo", R.drawable.ic_car,
            vehicleTypes.values.toList(), { label -> vehicleType = vehicleTypes.entries.first { it.value == label }.key }, Modifier.fillMaxWidth())
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VehicleYearField(year, { year = it; error = "" }, Modifier.weight(1f))
            VehicleTextField(mileage, { mileage = it; error = "" }, "Chilometri *", "Es. 0", R.drawable.ic_speedometer, Modifier.weight(1f), "km", KeyboardType.Number)
        }
        VehicleTextField(plate, { plate = it.uppercase(Locale.ITALY); error = "" }, "Targa *", "Es. EN093PW", R.drawable.ic_license_plate, Modifier.fillMaxWidth())
        VehicleSelectionField("Carburante", fuelChoice, "Seleziona carburante", R.drawable.ic_fuel,
            listOf("Non specificato") + fuelOptions + "Altro", { fuelChoice = if (it == "Non specificato") "" else it; error = "" }, Modifier.fillMaxWidth())
        if (fuelChoice == "Altro") VehicleTextField(customFuel, { customFuel = it; error = "" }, "Specifica carburante *", "Es. Benzina/etanolo", R.drawable.ic_fuel, Modifier.fillMaxWidth())
        VehicleRegistrationField(registration, { registration = it })
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 3.dp))
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(28.dp)) { Text("Annulla", fontWeight = FontWeight.SemiBold) }
            GradientButton(onClick = {
                val parsedYear = year.toIntOrNull(); val parsedKm = mileage.toIntOrNull()
                if (name.isBlank() || make.isBlank() || plate.isBlank() || parsedYear == null || parsedYear !in 1900..LocalDate.now().year || parsedKm == null || parsedKm < 0) { error = "Controlla nome, marca, targa, anno e chilometri"; return@GradientButton }
                val fuel = if (fuelChoice == "Altro") customFuel.trim() else fuelChoice
                if (fuelChoice == "Altro" && fuel.isBlank()) { error = "Specifica il carburante"; return@GradientButton }
                runCatching { val photo = photoUri?.let { repo.readUri(it, 15 * 1024 * 1024) } ?: existing?.photo
                    onSave((existing ?: Vehicle()).copy(name = name.trim(), make = make.trim(), model = model.trim(), year = parsedYear, plate = plate.trim(), mileage = parsedKm, registrationDate = registration, photo = photo, fuel = fuel, vehicleType = vehicleType, updatedAt = now()))
                }.onFailure { error = it.message ?: "Foto non leggibile" }
            }, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(28.dp)) { Text("Salva auto", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable private fun VehiclePhotoField(photoUri: Uri?, existingPhoto: ByteArray?, onClick: () -> Unit) {
    val context = LocalContext.current
    val preview = remember(photoUri) { photoUri?.let { uri -> runCatching {
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = 4 })?.asImageBitmap() }
    }.getOrNull() } }
    val hasPhoto = preview != null || existingPhoto != null
    val outline = MaterialTheme.colorScheme.outline.copy(alpha = .35f)
    val shape = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxWidth().height(148.dp).clip(shape).background(MaterialTheme.colorScheme.surface)
        .clickable(onClick = onClick).padding(8.dp)
        .drawBehind {
            val width = 1.dp.toPx()
            drawRoundRect(outline, topLeft = Offset(width, width),
                size = Size(size.width - 2 * width, size.height - 2 * width),
                cornerRadius = CornerRadius(20.dp.toPx()),
                style = Stroke(width = width, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 6.dp.toPx()))))
        }, contentAlignment = Alignment.Center) {
        if (preview != null) Image(preview, contentDescription = "Foto auto selezionata", modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(20.dp)), contentScale = ContentScale.Crop)
        else if (existingPhoto != null) VehicleImage(existingPhoto, Modifier.fillMaxSize().clip(RoundedCornerShape(20.dp)))
        if (hasPhoto) {
            Text("Sostituisci foto", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp).background(Color.Black.copy(alpha = .72f), RoundedCornerShape(18.dp)).padding(horizontal = 15.dp, vertical = 7.dp))
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(62.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape), contentAlignment = Alignment.Center) {
                    Icon(painterResource(R.drawable.ic_car), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(38.dp))
                    Box(Modifier.align(Alignment.BottomEnd).size(22.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
                        Text("+", color = MaterialTheme.colorScheme.onPrimary, fontSize = 20.sp, lineHeight = 20.sp)
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text("Aggiungi una foto", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text("Foto della tua auto (facoltativa)", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable private fun VehicleFieldFrame(
    label: String, icon: Int, modifier: Modifier = Modifier, highlighted: Boolean = false,
    onClick: (() -> Unit)? = null, trailing: (@Composable () -> Unit)? = null, content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier.heightIn(min = 59.dp).clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (highlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .32f), shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        MaintenanceIcon(icon)
        Spacer(Modifier.width(9.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(2.dp))
            content()
        }
        trailing?.invoke()
    }
}

@Composable private fun VehicleTextField(
    value: String, onValueChange: (String) -> Unit, label: String, placeholder: String, icon: Int,
    modifier: Modifier = Modifier, suffix: String = "", keyboardType: KeyboardType = KeyboardType.Text
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val focusRequester = remember { FocusRequester() }
    VehicleFieldFrame(label, icon, modifier, highlighted = focused, onClick = { focusRequester.requestFocus() },
        trailing = if (suffix.isEmpty()) null else { { Text(suffix, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(start = 4.dp)) } }) {
        BasicTextField(
            value = value, onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().focusRequester(focusRequester).semantics { contentDescription = label },
            interactionSource = interaction, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            decorationBox = { innerTextField -> Box {
                if (value.isEmpty()) Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .7f), fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                innerTextField()
            } }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun VehicleSelectionField(
    label: String, value: String, placeholder: String, icon: Int,
    options: List<String>, onValueChange: (String) -> Unit, modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }, modifier = modifier) {
        VehicleFieldFrame(label, icon, Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
            trailing = { Icon(painterResource(R.drawable.ic_chevron_down), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(19.dp)) }) {
            Text(value.ifEmpty { placeholder }, color = if (value.isEmpty()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }, modifier = Modifier.heightIn(max = 360.dp)) {
            options.forEach { option -> DropdownMenuItem(text = { Text(option) }, onClick = { onValueChange(option); expanded = false }) }
        }
    }
}

@Composable private fun VehicleYearField(value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier) {
    var showDialog by remember { mutableStateOf(false) }
    var input by remember { mutableStateOf(value) }
    var error by remember { mutableStateOf(false) }
    VehicleFieldFrame("Anno *", R.drawable.ic_calendar_nav, modifier, onClick = { input = value; error = false; showDialog = true },
        trailing = { Icon(painterResource(R.drawable.ic_chevron_down), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp)) }) {
        Text(value, fontSize = 15.sp, maxLines = 1)
    }
    if (showDialog) AlertDialog(
        onDismissRequest = { showDialog = false },
        title = { Text("Anno dell'auto") },
        text = { Column {
            OutlinedTextField(input, { input = it.filter(Char::isDigit); error = false }, label = { Text("Anno") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
            if (error) Text("Inserisci un anno tra 1900 e ${LocalDate.now().year}", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        } },
        confirmButton = { TextButton(onClick = {
            val parsed = input.toIntOrNull()
            if (parsed == null || parsed !in 1900..LocalDate.now().year) error = true
            else { onValueChange(parsed.toString()); showDialog = false }
        }) { Text("Conferma") } },
        dismissButton = { TextButton(onClick = { showDialog = false }) { Text("Annulla") } }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun VehicleRegistrationField(value: String, onDateSelected: (String) -> Unit) {
    var showPicker by remember { mutableStateOf(false) }
    VehicleFieldFrame("Data di immatricolazione", R.drawable.ic_calendar_nav, Modifier.fillMaxWidth(), onClick = { showPicker = true },
        trailing = { MaintenanceIcon(R.drawable.ic_calendar_nav) }) {
        Text(if (value.isBlank()) "Seleziona data" else dateLabel(value),
            color = if (value.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            fontSize = 15.sp, maxLines = 1)
    }
    if (value.isNotBlank()) TextButton(onClick = { onDateSelected("") }, modifier = Modifier.fillMaxWidth()) { Text("Rimuovi data") }
    if (showPicker) {
        val initial = runCatching { LocalDate.parse(value) }.getOrDefault(LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val picker = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(onDismissRequest = { showPicker = false }, confirmButton = {
            TextButton(onClick = {
                picker.selectedDateMillis?.let { onDateSelected(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                showPicker = false
            }) { Text("Conferma") }
        }, dismissButton = { TextButton(onClick = { showPicker = false }) { Text("Annulla") } }) { DatePicker(state = picker) }
    }
}

@Composable internal fun MaintenanceEditor(vehicle: Vehicle, existing: Maintenance?, existingReminder: Reminder?, onDismiss: () -> Unit, onSave: (Maintenance, Reminder?) -> Unit) {
    val types = listOf(
        Triple("service", "Tagliando", R.drawable.ic_wrench),
        Triple("inspection", "Revisione", R.drawable.ic_settings_nav),
        Triple("tax", "Bollo", R.drawable.ic_receipt),
        Triple("insurance", "Assicurazione", R.drawable.ic_shield),
        Triple("tires", "Cambio gomme", R.drawable.ic_tire),
        Triple("custom", "Altro", R.drawable.ic_more)
    )
    var type by remember(existing?.id) { mutableStateOf(existing?.type ?: "service") }
    var customName by remember(existing?.id) { mutableStateOf(existing?.customName ?: "") }
    var date by remember(existing?.id) { mutableStateOf(existing?.date ?: LocalDate.now().toString()) }
    var mileage by remember(existing?.id) { mutableStateOf((existing?.mileage ?: vehicle.mileage).toString()) }
    var cost by remember(existing?.id) { mutableStateOf(String.format(Locale.ITALY, "%.2f", existing?.cost ?: 0.0)) }
    var notes by remember(existing?.id) { mutableStateOf(existing?.notes ?: "") }
    var reminderEnabled by remember(existing?.id) { mutableStateOf(existingReminder?.active ?: (existing == null)) }
    var reminderType by remember(existing?.id) { mutableStateOf(existingReminder?.type ?: "interval") }
    var dueDate by remember(existing?.id) { mutableStateOf(existingReminder?.dueDate ?: "") }
    var threshold by remember(existing?.id) { mutableStateOf(existingReminder?.mileageThreshold?.toString() ?: "") }
    var interval by remember(existing?.id) { mutableStateOf(existingReminder?.intervalValue?.toString() ?: "1") }
    var unit by remember(existing?.id) { mutableStateOf(existingReminder?.intervalUnit?.ifBlank { "years" } ?: "years") }
    var error by remember { mutableStateOf("") }
    var thresholdFocused by remember { mutableStateOf(false) }
    val formScroll = rememberScrollState()
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    LaunchedEffect(thresholdFocused, imeBottom) {
        if (thresholdFocused && imeBottom > 0) formScroll.animateScrollTo(formScroll.maxValue)
    }
    val accent = MaterialTheme.colorScheme.primary
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    LaunchedEffect(type) { if (existing == null) { val defaults = mapOf("service" to (1 to "years"), "inspection" to (2 to "years"), "tax" to (1 to "years"), "insurance" to (1 to "years"), "tires" to (6 to "months")); defaults[type]?.let { interval = it.first.toString(); unit = it.second }; reminderEnabled = type != "custom" } }
    Column(
        Modifier.fillMaxSize().imePadding().verticalScroll(formScroll)
            .padding(horizontal = 22.dp).padding(top = 18.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text("INTERVENTI", color = accent, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(5.dp))
                Text(if (existing == null) "Nuovo intervento" else "Modifica intervento", fontSize = 31.sp, lineHeight = 33.sp, fontWeight = FontWeight.Black, maxLines = 2)
                Spacer(Modifier.height(3.dp))
                Text(vehicle.name, color = muted, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Box(Modifier.size(width = 86.dp, height = 67.dp).clip(RoundedCornerShape(17.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) {
                if (vehicle.photo != null) VehicleImage(vehicle.photo, Modifier.fillMaxSize())
                else Icon(painterResource(R.drawable.ic_car), contentDescription = null, tint = accent, modifier = Modifier.size(32.dp))
            }
        }
        Card(
            Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(Modifier.padding(14.dp).selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Tipo di intervento", fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 2.dp, bottom = 4.dp))
                types.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { (key, label, icon) ->
                            MaintenanceChoice(key == type, label, icon, { type = key }, Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        if (type == "custom") MaintenanceInput(customName, { customName = it }, "Nome intervento *", R.drawable.ic_edit, Modifier.fillMaxWidth())
        MaintenanceDateField("Data intervento *", date, { date = it })
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MaintenanceInput(mileage, { mileage = it }, "Chilometri *", R.drawable.ic_speedometer, Modifier.weight(1f), "km", KeyboardType.Number)
            MaintenanceInput(cost, { cost = it }, "Costo € *", R.drawable.ic_coins, Modifier.weight(1f), "€", KeyboardType.Decimal)
        }
        MaintenanceNotesField(notes, { notes = it })
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .2f))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Promemoria", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Text("Imposta un promemoria per questo intervento", color = muted, fontSize = 12.sp)
            }
            Switch(checked = reminderEnabled, onCheckedChange = { reminderEnabled = it })
        }
        if (reminderEnabled) {
            val modes = listOf(
                Triple("date", "Data", R.drawable.ic_calendar_nav),
                Triple("interval", "Intervallo", R.drawable.ic_repeat),
                Triple("mileage", "Km", R.drawable.ic_speedometer),
                Triple("both", "Entrambi", R.drawable.ic_coins)
            )
            Row(Modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                modes.forEach { (key, label, icon) -> MaintenanceChoice(key == reminderType, label, icon, { reminderType = key }, Modifier.weight(1f), compact = true) }
            }
            if (reminderType == "date" || reminderType == "both") MaintenanceDateField("Data di scadenza *", dueDate, { dueDate = it })
            if (reminderType == "interval") MaintenanceIntervalPicker(
                interval.toIntOrNull() ?: 1, unit,
                onIntervalChange = { interval = it.toString() }, onUnitChange = { unit = it },
                date = date
            )
            if (reminderType == "mileage" || reminderType == "both") MaintenanceInput(threshold, { threshold = it }, "Soglia chilometrica *", R.drawable.ic_speedometer, Modifier.fillMaxWidth(), "km", KeyboardType.Number,
                onFocusChange = { thresholdFocused = it })
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(2.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(28.dp)) { Text("Annulla", fontWeight = FontWeight.SemiBold) }
            GradientButton(onClick = {
                val parsedDate = runCatching { LocalDate.parse(date) }.getOrNull()
                val km = mileage.toIntOrNull()
                val euro = cost.replace(',', '.').toDoubleOrNull()
                val due = if (reminderType in listOf("date", "both")) runCatching { LocalDate.parse(dueDate) }.getOrNull() else null
                val nextKm = threshold.toIntOrNull()
                val intervalValue = interval.toIntOrNull()
                if (parsedDate == null || km == null || km < 0 || euro == null || !euro.isFinite() || euro < 0 || (type == "custom" && customName.isBlank())) {
                    error = "Controlla i dati dell'intervento"; return@GradientButton
                }
                if (reminderEnabled && ((reminderType in listOf("date", "both") && (due == null || due.isBefore(LocalDate.now()))) ||
                            (reminderType == "interval" && (intervalValue == null || intervalValue !in 1..24)) ||
                            (reminderType in listOf("mileage", "both") && (nextKm == null || nextKm <= maxOf(km, vehicle.mileage))))) {
                    error = "Controlla data, intervallo o soglia del promemoria"; return@GradientButton
                }
                val m = (existing ?: Maintenance(vehicleId = vehicle.id)).copy(type = type, customName = if (type == "custom") customName.trim() else "", date = date, mileage = km, cost = euro, notes = notes.trim(), updatedAt = now())
                val reminder = if (!reminderEnabled) null else (existingReminder ?: Reminder(maintenanceId = m.id)).copy(
                    type = reminderType,
                    dueDate = when (reminderType) {
                        "interval" -> (if (unit == "months") parsedDate.plusMonths(intervalValue!!.toLong()) else parsedDate.plusYears(intervalValue!!.toLong())).toString()
                        "date", "both" -> dueDate
                        else -> ""
                    },
                    mileageThreshold = if (reminderType in listOf("mileage", "both")) nextKm else null,
                    intervalValue = if (reminderType == "interval") intervalValue else null,
                    intervalUnit = if (reminderType == "interval") unit else "",
                    active = vehicle.status == "active", updatedAt = now()
                )
                onSave(m, reminder)
            }, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(28.dp)) { Text("Salva intervento", fontWeight = FontWeight.Bold, maxLines = 1, fontSize = 13.sp) }
        }
    }
}

@Composable private fun MaintenanceChoice(selected: Boolean, label: String, icon: Int, onClick: () -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val shape = RoundedCornerShape(13.dp)
    val accent = MaterialTheme.colorScheme.primary
    Row(
        modifier.height(if (compact) 48.dp else 53.dp).clip(shape)
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) accent else MaterialTheme.colorScheme.outline.copy(alpha = .43f), shape)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = if (compact) 5.dp else 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(painterResource(icon), contentDescription = null, tint = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(if (compact) 18.dp else 19.dp))
        Spacer(Modifier.width(if (compact) 4.dp else 3.dp))
        Text(label, fontSize = 10.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable private fun MaintenanceIcon(icon: Int) {
    Box(Modifier.size(34.dp).background(MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape), contentAlignment = Alignment.Center) {
        Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
    }
}

@Composable private fun MaintenanceInput(
    value: String, onValueChange: (String) -> Unit, label: String, icon: Int, modifier: Modifier = Modifier,
    suffix: String = "", keyboardType: KeyboardType = KeyboardType.Text, onFocusChange: ((Boolean) -> Unit)? = null
) {
    val requester = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()
    OutlinedTextField(
        value = value, onValueChange = onValueChange,
        modifier = modifier.bringIntoViewRequester(requester).onFocusChanged { focus ->
            onFocusChange?.invoke(focus.isFocused)
            if (focus.isFocused) scope.launch { delay(240); requester.bringIntoView() }
        },
        label = { Text(label, fontSize = 12.sp) },
        leadingIcon = { MaintenanceIcon(icon) },
        suffix = if (suffix.isBlank()) null else { { Text(suffix, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp) } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        textStyle = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = .43f)
        )
    )
}

@Composable private fun MaintenanceNotesField(value: String, onValueChange: (String) -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    val requester = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()
    Row(
        Modifier.fillMaxWidth().height(96.dp).bringIntoViewRequester(requester).clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .43f), shape)
            .padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.Top
    ) {
        MaintenanceIcon(R.drawable.ic_document)
        Spacer(Modifier.width(11.dp))
        Column {
            Text("Note", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Spacer(Modifier.height(4.dp))
            BasicTextField(
                value = value, onValueChange = onValueChange,
                modifier = Modifier.fillMaxWidth().onFocusChanged { focus ->
                    if (focus.isFocused) scope.launch { delay(240); requester.bringIntoView() }
                }.semantics { contentDescription = "Note" },
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                minLines = 2, maxLines = 3,
                decorationBox = { innerTextField ->
                    Box {
                        if (value.isEmpty()) Text("Aggiungi una nota...", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        innerTextField()
                    }
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun MaintenanceDateField(label: String, value: String, onDateSelected: (String) -> Unit) {
    var showPicker by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().height(66.dp).clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .43f), shape)
            .clickable { showPicker = true }.padding(horizontal = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(painterResource(R.drawable.ic_calendar_nav), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(25.dp))
        Spacer(Modifier.width(15.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Text(if (value.isBlank()) "Seleziona data" else dateLabel(value), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
        MaintenanceIcon(R.drawable.ic_calendar_nav)
    }
    if (showPicker) {
        val initial = runCatching { LocalDate.parse(value) }.getOrDefault(LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val picker = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(onDismissRequest = { showPicker = false }, confirmButton = {
            TextButton(onClick = {
                picker.selectedDateMillis?.let { onDateSelected(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                showPicker = false
            }) { Text("Conferma") }
        }, dismissButton = { TextButton(onClick = { showPicker = false }) { Text("Annulla") } }) { DatePicker(state = picker) }
    }
}

@Composable private fun MaintenanceIntervalPicker(
    value: Int, unit: String, onIntervalChange: (Int) -> Unit, onUnitChange: (String) -> Unit, date: String
) {
    val nextDate = runCatching {
        LocalDate.parse(date).let { if (unit == "months") it.plusMonths(value.toLong()) else it.plusYears(value.toLong()) }
    }.getOrNull()
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .43f), RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Ripeti ogni", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = { onIntervalChange((value - 1).coerceAtLeast(1)) }, enabled = value > 1,
                modifier = Modifier.size(52.dp), contentPadding = PaddingValues(0.dp), shape = RoundedCornerShape(14.dp)) {
                Text("−", fontSize = 25.sp)
            }
            Text(value.toString(), modifier = Modifier.weight(1f), textAlign = TextAlign.Center, fontSize = 27.sp, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = { onIntervalChange((value + 1).coerceAtMost(24)) }, enabled = value < 24,
                modifier = Modifier.size(52.dp), contentPadding = PaddingValues(0.dp), shape = RoundedCornerShape(14.dp)) {
                Text("+", fontSize = 25.sp)
            }
            MaintenanceUnit("Mesi", unit == "months", { onUnitChange("months") })
            MaintenanceUnit("Anni", unit == "years", { onUnitChange("years") })
        }
        nextDate?.let { Text("Prossima scadenza: ${dateLabel(it.toString())}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp) }
    }
}

@Composable private fun MaintenanceUnit(label: String, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(13.dp)
    Box(
        Modifier.height(56.dp).widthIn(min = 50.dp).clip(shape)
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .43f), shape)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick).padding(horizontal = 9.dp),
        contentAlignment = Alignment.Center
    ) { Text(label, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium) }
}

@Composable internal fun StatusEditor(vehicle: Vehicle, dismiss: () -> Unit, save: (Vehicle) -> Unit) {
    var status by remember(vehicle.id) { mutableStateOf(vehicle.status) }; var date by remember(vehicle.id) { mutableStateOf(vehicle.statusDate.ifBlank { LocalDate.now().toString() }) }; var note by remember(vehicle.id) { mutableStateOf(vehicle.statusNote) }; var error by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = dismiss, title = { Text("Gestisci auto") }, text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("active" to "Attiva", "sold" to "Venduta", "scrapped" to "Rottamata").forEach { (key, label) -> Row(Modifier.clickable { status = key }, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) { RadioButton(status == key, { status = key }); Text(label) } }
        if (status != "active") { OutlinedTextField(date, { date = it }, label = { Text("Data AAAA-MM-GG") }); OutlinedTextField(note, { note = it }, label = { Text("Nota sullo stato") }) }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
    } }, confirmButton = { TextButton(onClick = { if (status != "active" && runCatching { LocalDate.parse(date) }.isFailure) { error = "Data non valida"; return@TextButton }; save(vehicle.copy(status = status, statusDate = if (status == "active") "" else date, statusNote = if (status == "active") "" else note, updatedAt = now())) }) { Text("Conferma") } }, dismissButton = { TextButton(onClick = dismiss) { Text("Annulla") } })
}

@Composable internal fun ConfirmDelete(text: String, dismiss: () -> Unit, confirm: () -> Unit) { AlertDialog(onDismissRequest = dismiss, title = { Text("Conferma eliminazione") }, text = { Text(text) }, confirmButton = { TextButton(onClick = confirm, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Elimina") } }, dismissButton = { TextButton(onClick = dismiss) { Text("Annulla") } }) }
