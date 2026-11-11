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

/** The Italian plate, drawn; [compact] is the smaller one over the photo of the car. */
@Composable internal fun VehiclePlate(plate: String, type: String, registrationYear: Int, modifier: Modifier = Modifier, compact: Boolean = false) {
    val twoWheeler = type == "motorcycle" || type == "scooter"
    if (compact) {
        Text(plate.uppercase(Locale.ITALY).filterNot(Char::isWhitespace), color = Color(0xFF151515), fontSize = 14.sp, letterSpacing = 1.8.sp, fontWeight = FontWeight.Black,
            modifier = modifier.clip(RoundedCornerShape(6.dp)).background(Color(0xFFF7F7F2))
                .drawBehind { drawRect(Color(0xFF0755AD), size = Size(7.dp.toPx(), size.height)) }
                .padding(start = 14.dp, end = 9.dp, top = 4.dp, bottom = 4.dp))
        return
    }
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

/**
 * Full-screen editor frame: close button, big title, the form scrolling in between and the save bar
 * pinned at the bottom (above the keyboard when it is open).
 */
@Composable internal fun EditorScaffold(
    overline: String, title: String, subtitle: String, onDismiss: () -> Unit, saveLabel: String,
    scroll: androidx.compose.foundation.ScrollState = rememberScrollState(), header: @Composable RowScope.() -> Unit = {},
    onSave: () -> Unit, content: @Composable ColumnScope.() -> Unit
) {
    Column(Modifier.fillMaxSize().imePadding()) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            RoundIconButton(R.drawable.ic_close, "Chiudi senza salvare", onDismiss)
        }
        Column(Modifier.weight(1f).verticalScroll(scroll).padding(horizontal = 20.dp).padding(top = 6.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 8.dp).staggerIn(0), verticalAlignment = Alignment.CenterVertically) {
                PageHeading(overline, title, subtitle, Modifier.weight(1f))
                header()
            }
            content()
        }
        Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background)) {
            HorizontalDivider(color = hairline())
            Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Annulla") }
                AccentButton(onClick = onSave, modifier = Modifier.weight(1.5f)) { Text(saveLabel, maxLines = 1) }
            }
        }
    }
}

private fun notesUpdatedLabel(value: String): String = if (value.isBlank()) "Mai modificate" else runCatching {
    "Modificate il " + dateLabel(Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalDate().toString())
}.getOrDefault(value)

/** The car's notes, edited in place; "Salva" appears only when something changed. */
@Composable internal fun GarageNotesCard(updatedAt: String, value: String, onValueChange: (String) -> Unit, changed: Boolean, onSave: () -> Unit) {
    val requester = remember { BringIntoViewRequester() }
    var focused by remember { mutableStateOf(false) }
    val imeBottom = WindowInsets.ime.getBottom(LocalDensity.current)
    LaunchedEffect(focused, imeBottom) { if (focused && imeBottom > 0) requester.bringIntoView() }
    Panel(Modifier.fillMaxWidth().bringIntoViewRequester(requester), padding = 16.dp) {
        BasicTextField(
            value = value, onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp).onFocusChanged { focused = it.isFocused }.semantics { contentDescription = "Note sull'auto" },
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface, lineHeight = 23.sp),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            decorationBox = { inner -> Box {
                if (value.isEmpty()) Text("Scrivi qui le tue note sull'auto: gomme, misure, officina di fiducia…", color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 23.sp)
                inner()
            } }
        )
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(painterResource(R.drawable.ic_clock), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(6.dp))
            Text(notesUpdatedLabel(updatedAt), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.weight(1f), maxLines = 1)
            AnimatedVisibility(changed, enter = fadeIn() + androidx.compose.animation.scaleIn(initialScale = .8f), exit = fadeOut()) {
                AccentButton(onClick = onSave, modifier = Modifier.heightIn(min = 40.dp), shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(horizontal = 16.dp)) {
                    Text("Salva note", fontSize = 14.sp)
                }
            }
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


@Composable internal fun MaintenanceFilterPill(type: String, selected: Boolean, onClick: () -> Unit) {
    val appearance = maintenanceAppearance(type)
    FilterPill(if (type == "all") "Tutti" else appearance.label, if (type == "all") null else appearance.icon, selected, onClick)
}

@Composable private fun FilterPill(label: String, icon: Int?, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    val fg = if (selected) onAccent() else MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        Modifier.height(38.dp).clip(shape)
            .background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
            .border(1.dp, if (selected) Color.Transparent else hairline(), shape)
            .bouncyClick(role = Role.RadioButton, onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        if (icon != null) Icon(painterResource(icon), contentDescription = null, tint = fg, modifier = Modifier.size(17.dp))
        Text(label, fontSize = 13.sp, color = fg, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
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

@Composable internal fun DocumentFilterPill(category: String, selected: Boolean, onClick: () -> Unit) {
    val appearance = documentAppearance(category)
    FilterPill(if (category == "all") "Tutti" else appearance.label, if (category == "all") null else appearance.icon, selected, onClick)
}

internal fun documentSize(size: Int): String = if (size >= 1_000_000) {
    String.format(Locale.ITALY, "%.1f MB", size / 1_000_000.0)
} else "${(size + 999) / 1000} KB"

internal fun documentDate(timestamp: String): String = runCatching {
    dateLabel(Instant.parse(timestamp).atZone(ZoneId.systemDefault()).toLocalDate().toString())
}.getOrDefault(timestamp.take(10))

@Composable internal fun DocumentThumbnail(document: GarageDocument, category: String, modifier: Modifier = Modifier.size(72.dp), maxPixels: Int = 320, corner: androidx.compose.ui.unit.Dp = 13.dp) {
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
    Box(modifier.clip(RoundedCornerShape(corner)).background(documentAppearance(category).background), contentAlignment = Alignment.Center) {
        if (preview != null) Image(preview!!.asImageBitmap(), contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else Icon(painterResource(R.drawable.ic_document), contentDescription = null, tint = documentAppearance(category).tint, modifier = Modifier.size(32.dp))
    }
}

internal fun documentFormat(document: GarageDocument): String = when (document.mimeType) {
    "application/pdf" -> "PDF"; "image/jpeg" -> "JPG"; "image/png" -> "PNG"
    else -> document.name.substringAfterLast('.', "FILE").uppercase(Locale.ITALY)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun DocumentEditor(
    uri: Uri?, name: String, error: String,
    existing: GarageDocument?,
    maintenances: List<Maintenance>, linkedMaintenanceId: String?, onLinkMaintenanceChange: (String?) -> Unit,
    onNameChange: (String) -> Unit, onCamera: () -> Unit, onGallery: () -> Unit, onFile: () -> Unit,
    onDismiss: () -> Unit, onSave: () -> Unit
) {
    EditorScaffold("Documento", if (existing == null) "Nuovo documento" else "Modifica documento", "Conserva una copia accessibile anche offline.", onDismiss, "Salva documento", onSave = onSave) {
        Overline(if (existing == null) "Scegli il file" else "Sostituisci il file")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SourceTile("Fotocamera", R.drawable.ic_camera, onCamera, Modifier.weight(1f))
            SourceTile("Galleria", R.drawable.ic_image, onGallery, Modifier.weight(1f))
            SourceTile("File", R.drawable.ic_folder, onFile, Modifier.weight(1f))
        }
        Panel(Modifier.fillMaxWidth(), padding = 14.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val picked = uri != null || existing != null
                if (picked) AccentBadge(R.drawable.ic_document, 40.dp, 20.dp)
                else TintBadge(R.drawable.ic_document, MaterialTheme.colorScheme.onSurfaceVariant, MaterialTheme.colorScheme.surfaceContainerHigh, 40.dp, 20.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(when { uri != null -> "File selezionato"; existing != null -> "File attuale"; else -> "Nessun file scelto" }, fontWeight = FontWeight.SemiBold)
                    Text(when { uri != null -> uri.lastPathSegment?.substringAfterLast('/') ?: "Pronto"; existing != null -> existing.name; else -> "PDF, immagini e altri file fino a 10 MB" },
                        color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        Overline("Dettagli")
        OutlinedTextField(name, onNameChange, label = { Text("Nome documento *") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp))
        var interventionsExpanded by remember { mutableStateOf(false) }
        ExposedDropdownMenuBox(expanded = interventionsExpanded, onExpandedChange = { interventionsExpanded = it }) {
            val linked = maintenances.firstOrNull { it.id == linkedMaintenanceId }
            OutlinedTextField(
                value = linked?.let { "${maintenanceLabel(it)} · ${dateLabel(it.date)}" } ?: "Nessun intervento",
                onValueChange = {}, readOnly = true, singleLine = true, shape = RoundedCornerShape(14.dp),
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
    }
}

@Composable private fun SourceTile(label: String, icon: Int, onClick: () -> Unit, modifier: Modifier) {
    Panel(modifier, padding = 14.dp, onClickLabel = label, onClick = onClick) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(26.dp))
            Spacer(Modifier.height(8.dp))
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
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
    EditorScaffold("Scheda auto", if (existing == null) "Nuova auto" else "Modifica auto", "I dettagli della tua auto, sempre a portata di mano.", onDismiss, "Salva auto", onSave = {
        val parsedYear = year.toIntOrNull(); val parsedKm = mileage.toIntOrNull()
        if (name.isBlank() || make.isBlank() || plate.isBlank() || parsedYear == null || parsedYear !in 1900..LocalDate.now().year || parsedKm == null || parsedKm < 0) { error = "Controlla nome, marca, targa, anno e chilometri"; return@EditorScaffold }
        val fuel = if (fuelChoice == "Altro") customFuel.trim() else fuelChoice
        if (fuelChoice == "Altro" && fuel.isBlank()) { error = "Specifica il carburante"; return@EditorScaffold }
        runCatching { val photo = photoUri?.let { repo.readUri(it, 15 * 1024 * 1024) } ?: existing?.photo
            onSave((existing ?: Vehicle()).copy(name = name.trim(), make = make.trim(), model = model.trim(), year = parsedYear, plate = plate.trim(), mileage = parsedKm, registrationDate = registration, photo = photo, fuel = fuel, vehicleType = vehicleType, updatedAt = now()))
        }.onFailure { error = it.message ?: "Foto non leggibile" }
    }) {
        VehiclePhotoField(photoUri, existing?.photo, pickPhoto)
        Spacer(Modifier.height(4.dp))
        Overline("Identità")
        VehicleTextField(name, { name = it; error = "" }, "Nome auto *", "Es. La mia auto", R.drawable.ic_car, Modifier.fillMaxWidth())
        VehicleTextField(make, { make = it; error = "" }, "Marca *", "Es. Volkswagen", R.drawable.ic_shield, Modifier.fillMaxWidth())
        VehicleTextField(model, { model = it }, "Modello", "Es. UP", R.drawable.ic_layers, Modifier.fillMaxWidth())
        VehicleSelectionField("Tipo veicolo *", vehicleTypeLabel(vehicleType), "Seleziona tipo", R.drawable.ic_car,
            vehicleTypes.values.toList(), { label -> vehicleType = vehicleTypes.entries.first { it.value == label }.key }, Modifier.fillMaxWidth())
        Spacer(Modifier.height(4.dp))
        Overline("Dati tecnici")
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
    }
}

@Composable private fun VehiclePhotoField(photoUri: Uri?, existingPhoto: ByteArray?, onClick: () -> Unit) {
    val context = LocalContext.current
    val preview = remember(photoUri) { photoUri?.let { uri -> runCatching {
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = 4 })?.asImageBitmap() }
    }.getOrNull() } }
    val hasPhoto = preview != null || existingPhoto != null
    val outline = MaterialTheme.colorScheme.outline.copy(alpha = .35f)
    val shape = RoundedCornerShape(20.dp)
    Box(Modifier.fillMaxWidth().height(180.dp).clip(shape).background(MaterialTheme.colorScheme.surface)
        .clickable(onClick = onClick).padding(8.dp)
        .drawBehind {
            val width = 1.dp.toPx()
            drawRoundRect(outline, topLeft = Offset(width, width),
                size = Size(size.width - 2 * width, size.height - 2 * width),
                cornerRadius = CornerRadius(14.dp.toPx()),
                style = Stroke(width = width, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 6.dp.toPx()))))
        }, contentAlignment = Alignment.Center) {
        if (preview != null) Image(preview, contentDescription = "Foto auto selezionata", modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop)
        else if (existingPhoto != null) VehicleImage(existingPhoto, Modifier.fillMaxSize().clip(RoundedCornerShape(14.dp)))
        if (hasPhoto) {
            Text("Sostituisci foto", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 10.dp).background(Color.Black.copy(alpha = .72f), RoundedCornerShape(18.dp)).padding(horizontal = 15.dp, vertical = 7.dp))
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                AccentBadge(R.drawable.ic_camera, 56.dp, 28.dp)
                Spacer(Modifier.height(10.dp))
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
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.heightIn(min = 60.dp).clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (highlighted) MaterialTheme.colorScheme.primary else hairline(), shape)
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
        ) {
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
    EditorScaffold("Intervento", if (existing == null) "Nuovo intervento" else "Modifica intervento", vehicle.name, onDismiss, "Salva intervento", scroll = formScroll,
        header = {
            Box(Modifier.size(width = 78.dp, height = 58.dp).clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) {
                VehiclePhoto(vehicle, Modifier.fillMaxSize(), iconSize = 40.dp)
            }
        },
        onSave = {
            val parsedDate = runCatching { LocalDate.parse(date) }.getOrNull()
            val km = mileage.toIntOrNull()
            val euro = cost.replace(',', '.').toDoubleOrNull()
            val due = if (reminderType in listOf("date", "both")) runCatching { LocalDate.parse(dueDate) }.getOrNull() else null
            val nextKm = threshold.toIntOrNull()
            val intervalValue = interval.toIntOrNull()
            if (parsedDate == null || km == null || km < 0 || euro == null || !euro.isFinite() || euro < 0 || (type == "custom" && customName.isBlank())) {
                error = "Controlla i dati dell'intervento"; return@EditorScaffold
            }
            if (reminderEnabled && ((reminderType in listOf("date", "both") && (due == null || due.isBefore(LocalDate.now()))) ||
                        (reminderType == "interval" && (intervalValue == null || intervalValue !in 1..24)) ||
                        (reminderType in listOf("mileage", "both") && (nextKm == null || nextKm <= maxOf(km, vehicle.mileage))))) {
                error = "Controlla data, intervallo o soglia del promemoria"; return@EditorScaffold
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
        }) {
        Overline("Tipo")
        Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            types.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { (key, label, icon) -> MaintenanceChoice(key == type, label, icon, { type = key }, Modifier.weight(1f)) }
                }
            }
        }
        if (type == "custom") MaintenanceInput(customName, { customName = it }, "Nome intervento *", R.drawable.ic_edit, Modifier.fillMaxWidth())
        Spacer(Modifier.height(4.dp))
        Overline("Dettagli")
        MaintenanceDateField("Data intervento *", date, { date = it })
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MaintenanceInput(mileage, { mileage = it }, "Chilometri *", R.drawable.ic_speedometer, Modifier.weight(1f), "km", KeyboardType.Number)
            MaintenanceInput(cost, { cost = it }, "Costo *", R.drawable.ic_coins, Modifier.weight(1f), "€", KeyboardType.Decimal)
        }
        MaintenanceNotesField(notes, { notes = it })
        Spacer(Modifier.height(4.dp))
        Panel(Modifier.fillMaxWidth(), padding = 16.dp) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                AccentBadge(R.drawable.ic_clock, 40.dp, 20.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Promemoria", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text("Ricordami quando rifarlo", color = muted, fontSize = 13.sp)
                }
                Switch(checked = reminderEnabled, onCheckedChange = { reminderEnabled = it })
            }
            AnimatedVisibility(reminderEnabled) {
                Column(Modifier.padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    val modes = listOf(
                        Triple("date", "Data", R.drawable.ic_calendar_nav),
                        Triple("interval", "Intervallo", R.drawable.ic_repeat),
                        Triple("mileage", "Km", R.drawable.ic_speedometer),
                        Triple("both", "Data e km", R.drawable.ic_layers)
                    )
                    Row(Modifier.fillMaxWidth().selectableGroup(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
            }
        }
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
    }
}

@Composable private fun MaintenanceChoice(selected: Boolean, label: String, icon: Int, onClick: () -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val shape = RoundedCornerShape(14.dp)
    val accent = MaterialTheme.colorScheme.primary
    val bg by animateColorAsState(if (selected) accent.copy(alpha = .14f) else MaterialTheme.colorScheme.surface, tween(200), label = "choice_bg")
    Column(
        modifier.height(if (compact) 58.dp else 70.dp).clip(shape).background(bg)
            .border(1.dp, if (selected) accent else hairline(), shape)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(painterResource(icon), contentDescription = null, tint = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(if (compact) 19.dp else 22.dp))
        Spacer(Modifier.height(5.dp))
        Text(label, fontSize = if (compact) 11.sp else 12.sp, color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable private fun MaintenanceIcon(icon: Int) {
    AccentBadge(icon, 34.dp, 18.dp)
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
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = .3f)
        )
    )
}

@Composable private fun MaintenanceNotesField(value: String, onValueChange: (String) -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    val requester = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()
    Row(
        Modifier.fillMaxWidth().height(96.dp).bringIntoViewRequester(requester).clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .3f), shape)
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
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier.fillMaxWidth().height(66.dp).clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .3f), shape)
            .clickable { showPicker = true }.padding(horizontal = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(painterResource(R.drawable.ic_calendar_nav), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(25.dp))
        Spacer(Modifier.width(15.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Text(if (value.isBlank()) "Seleziona data" else dateLabel(value), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
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
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .3f), RoundedCornerShape(18.dp))
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
            .border(1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .3f), shape)
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
