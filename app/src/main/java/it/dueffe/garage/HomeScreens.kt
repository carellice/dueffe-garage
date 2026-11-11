package it.dueffe.garage

import android.graphics.BitmapFactory
import android.os.SystemClock
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.*
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.absoluteValue

// ───────────────────────── Shared bits ─────────────────────────

/** Top bar of an inner page: back button, title and optional actions on the right. */
@Composable internal fun PageTopBar(title: String, onBack: () -> Unit, backLabel: String, modifier: Modifier = Modifier, actions: @Composable RowScope.() -> Unit = {}) {
    Row(modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        RoundIconButton(R.drawable.ic_arrow_back, "Torna a $backLabel", onBack)
        Spacer(Modifier.width(12.dp))
        Text(title, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        actions()
    }
}

/** Big page title with an overline above it. */
@Composable internal fun PageHeading(overline: String, title: String, subtitle: String = "", modifier: Modifier = Modifier) {
    Column(modifier) {
        Overline(overline, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(6.dp))
        Text(title, fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.8).sp)
        if (subtitle.isNotBlank()) { Spacer(Modifier.height(4.dp)); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp, lineHeight = 20.sp) }
    }
}

@Composable internal fun VehicleImage(data: ByteArray?, modifier: Modifier = Modifier) {
    val bitmap = remember(data) { data?.let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } }
    if (bitmap != null) Image(BitmapPainter(bitmap), contentDescription = "Foto auto", modifier = modifier, contentScale = ContentScale.Crop)
}

/** The car photo, or a carbon backdrop with the outline of the car when there is none. */
@Composable internal fun VehiclePhoto(v: Vehicle, modifier: Modifier = Modifier, iconSize: Dp = 140.dp) {
    Box(modifier) {
        if (v.photo != null) VehicleImage(v.photo, Modifier.fillMaxSize())
        else {
            val accent = Ice
            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF1A2230), Color(0xFF07090C))))
                .drawBehind {
                    val c = Offset(size.width * .78f, size.height * .25f)
                    drawCircle(Brush.radialGradient(listOf(accent.copy(alpha = .22f), Color.Transparent), c, size.width * .55f), size.width * .55f, c)
                }) {
                Icon(painterResource(R.drawable.ic_car), contentDescription = null, tint = Color.White.copy(alpha = .14f),
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 18.dp).size(iconSize).rotate(-6f))
            }
        }
    }
}

/** Centered empty state with a badge, used when a list has nothing yet. */
@Composable internal fun EmptyState(icon: Int, title: String, subtitle: String, modifier: Modifier = Modifier) {
    Panel(modifier.fillMaxWidth(), padding = 24.dp) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            AccentBadge(icon, 56.dp, 28.dp)
            Spacer(Modifier.height(14.dp))
            Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Spacer(Modifier.height(4.dp))
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, textAlign = TextAlign.Center, lineHeight = 19.sp)
        }
    }
}

/** Thin divider between rows of a grouped panel. */
@Composable internal fun RowDivider(start: Dp = 72.dp) {
    HorizontalDivider(Modifier.padding(start = start), color = hairline())
}

/**
 * One deadline as a compact row: a gauge that fills as the date approaches, what it is, the car
 * (when [showVehicle]) and how long is left, coloured by urgency.
 */
@Composable internal fun DeadlineRow(item: DueReminder, showVehicle: Boolean, onClick: () -> Unit) {
    val appearance = maintenanceAppearance(item.maintenance.type)
    val urgency = urgencyFor(item.days)
    val date = reminderDueDate(item)
    Row(Modifier.fillMaxWidth().bouncyClick(onClickLabel = "Apri scadenza ${appearance.label}", onClick = onClick)
        .padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Gauge(deadlineFraction(item.days), urgency.color, Modifier.size(46.dp), stroke = 3.5.dp) {
            Icon(painterResource(appearance.icon), contentDescription = null, tint = urgency.color, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(maintenanceLabel(item.maintenance), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val detail = listOfNotNull(item.vehicle.name.takeIf { showVehicle }, date.takeIf { it.isNotBlank() }?.let(::dateLabel),
                item.reminder.mileageThreshold?.takeIf { item.reminder.type != "date" && item.reminder.type != "interval" }?.formatKm())
            Text(detail.joinToString(" · ").ifBlank { reminderSubtitle(item) }, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Text(reminderStatus(item), color = urgency.color, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, maxLines = 1, style = Numeric)
    }
}

/** A grouped list of deadlines inside one panel. */
@Composable internal fun DeadlineGroup(items: List<DueReminder>, showVehicle: Boolean, modifier: Modifier = Modifier, onClick: (DueReminder) -> Unit) {
    Panel(modifier.fillMaxWidth(), padding = 0.dp) {
        items.forEachIndexed { i, item ->
            if (i > 0) RowDivider()
            DeadlineRow(item, showVehicle) { onClick(item) }
        }
    }
}

/** One reading of the instrument cluster: big number, small label. */
@Composable internal fun Readout(label: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.onSurface, value: @Composable (androidx.compose.ui.text.TextStyle) -> Unit) {
    Column(modifier) {
        value(Numeric.copy(fontSize = 24.sp, fontWeight = FontWeight.Bold, color = color, letterSpacing = (-.5).sp))
        Spacer(Modifier.height(2.dp))
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable internal fun ReadoutDivider() { Box(Modifier.width(1.dp).height(40.dp).background(hairline())) }

internal fun euro(value: Double, decimals: Boolean = false): String = String.format(Locale.ITALY, if (decimals) "€ %,.2f" else "€ %,.0f", value)

// ───────────────────────── Home ─────────────────────────

private var homeIntroPlayed = false

/**
 * The garage at a glance: a header with settings and "add car", the instrument cluster with the
 * numbers that matter, the cars as a showroom carousel and the next deadlines of every car.
 */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable internal fun GarageHome(
    state: GarageState, add: () -> Unit, open: (String) -> Unit, openReminder: (DueReminder) -> Unit,
    openAgenda: () -> Unit, openSettings: () -> Unit,
    sharedTransitionScope: SharedTransitionScope, animatedVisibilityScope: AnimatedVisibilityScope
) {
    var archiveOpen by remember { mutableStateOf(false) }; var query by remember { mutableStateOf("") }
    val active = state.vehicles.filter { it.status == "active" }
    val archivedAll = state.vehicles.filter { it.status != "active" }
    val archived = archivedAll.filter { "${it.name} ${it.make} ${it.plate}".contains(query, true) }
    val due = remember(state) { dueReminders(state) }
    val soon = due.count { (it.days ?: Long.MAX_VALUE) <= 30 }
    val year = LocalDate.now().year
    val activeIds = active.map { it.id }.toSet()
    val spentThisYear = state.maintenances.filter { it.vehicleId in activeIds && it.date.startsWith(year.toString()) }.sumOf { it.cost }
    val intro = remember { !homeIntroPlayed }
    LaunchedEffect(Unit) { homeIntroPlayed = true }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item(key = "header") {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 14.dp, top = 14.dp).staggerIn(0, enabled = intro), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Overline(LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.ITALY)))
                    Text("Garage", fontSize = 36.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp)
                }
                RoundIconButton(R.drawable.ic_settings_nav, "Impostazioni", openSettings)
                Spacer(Modifier.width(10.dp))
                RoundIconButton(R.drawable.ic_add, "Aggiungi auto", add, accent = true)
            }
        }
        if (active.isNotEmpty()) item(key = "cluster") {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 18.dp).staggerIn(1, enabled = intro), padding = 16.dp) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Readout("In garage", Modifier.weight(1f)) { AnimatedCount(active.size, it, animate = intro) }
                    ReadoutDivider()
                    Readout("In scadenza", Modifier.weight(1f), color = if (soon > 0) urgencyFor(10).color else MaterialTheme.colorScheme.onSurface) { AnimatedCount(soon, it, animate = intro) }
                    ReadoutDivider()
                    Readout("Spesi nel $year", Modifier.weight(1.3f)) { AnimatedCount(spentThisYear, it, animate = intro, format = { v -> euro(v) }) }
                }
            }
        }
        if (active.isEmpty()) item(key = "empty") {
            Column(Modifier.padding(horizontal = 18.dp).staggerIn(1, enabled = intro), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                EmptyState(R.drawable.ic_car,
                    if (state.vehicles.isEmpty()) "Il garage è pronto" else "Nessuna auto attiva",
                    if (state.vehicles.isEmpty()) "Aggiungi la tua prima auto: poi registri interventi, scadenze e documenti dalla sua pagina." else "Aggiungi un'auto o consulta l'archivio qui sotto.")
                AccentButton(onClick = add, modifier = Modifier.fillMaxWidth()) {
                    Icon(painterResource(R.drawable.ic_add), contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (state.vehicles.isEmpty()) "Aggiungi la tua prima auto" else "Aggiungi auto")
                }
            }
        } else item(key = "cars") {
            Column(Modifier.staggerIn(2, enabled = intro)) {
                SectionTitle(if (active.size == 1) "La tua auto" else "Le tue auto", Modifier.padding(horizontal = 20.dp))
                Spacer(Modifier.height(6.dp))
                if (active.size == 1) VehicleShowcase(active[0], due.firstOrNull { it.vehicle.id == active[0].id }, { open(active[0].id) }, sharedTransitionScope, animatedVisibilityScope, Modifier.padding(horizontal = 18.dp))
                else {
                    val pager = rememberPagerState { active.size }
                    HorizontalPager(pager, contentPadding = PaddingValues(horizontal = 18.dp), pageSpacing = 12.dp, key = { active[it].id }) { page ->
                        val v = active[page]
                        VehicleShowcase(v, due.firstOrNull { it.vehicle.id == v.id }, { open(v.id) }, sharedTransitionScope, animatedVisibilityScope,
                            Modifier.graphicsLayer {
                                // Cards away from the centre recede slightly, like a turntable.
                                val offset = ((pager.currentPage - page) + pager.currentPageOffsetFraction).absoluteValue.coerceIn(0f, 1f)
                                val s = 1f - .06f * offset
                                scaleX = s; scaleY = s; alpha = 1f - .35f * offset
                            })
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                        repeat(active.size) { i ->
                            val selected = pager.currentPage == i
                            val width by animateDpAsState(if (selected) 22.dp else 6.dp, spring(dampingRatio = .7f), label = "dot")
                            Box(Modifier.padding(horizontal = 3.dp).width(width).height(6.dp).clip(CircleShape)
                                .background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .35f)))
                        }
                    }
                }
            }
        }
        if (active.isNotEmpty()) item(key = "agenda") {
            Column(Modifier.padding(horizontal = 18.dp).staggerIn(3, enabled = intro)) {
                SectionTitle("Prossime scadenze", Modifier.padding(start = 2.dp), action = if (due.isNotEmpty()) "Vedi tutte" else null, onAction = openAgenda)
                Spacer(Modifier.height(6.dp))
                if (due.isEmpty()) Panel(Modifier.fillMaxWidth(), padding = 16.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TintBadge(R.drawable.ic_shield, urgencyFor(365).color, urgencyFor(365).color.copy(alpha = .13f))
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text("Tutto in regola", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                            Text("Registra un intervento con promemoria per vederlo qui.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                    }
                } else DeadlineGroup(due.take(3), showVehicle = active.size > 1, onClick = openReminder)
            }
        }
        if (archivedAll.isNotEmpty()) item(key = "archive") {
            Column(Modifier.padding(horizontal = 18.dp).animateContentSize(spring(dampingRatio = .9f, stiffness = Spring.StiffnessMediumLow)).staggerIn(4, enabled = intro)) {
                Panel(Modifier.fillMaxWidth(), padding = 14.dp, onClickLabel = if (archiveOpen) "Chiudi archivio" else "Apri archivio", onClick = { archiveOpen = !archiveOpen }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        AccentBadge(R.drawable.ic_folder, 40.dp, 20.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Archivio", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                            Text("${archivedAll.size} ${if (archivedAll.size == 1) "auto venduta o rottamata" else "auto vendute o rottamate"}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                        val rotation by animateFloatAsState(if (archiveOpen) 180f else 0f, spring(dampingRatio = .7f), label = "archive_chevron")
                        Icon(painterResource(R.drawable.ic_chevron_down), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp).rotate(rotation))
                    }
                }
                if (archiveOpen) {
                    Spacer(Modifier.height(10.dp))
                    if (archivedAll.size > 3) {
                        OutlinedTextField(query, { query = it }, placeholder = { Text("Cerca nell'archivio") }, singleLine = true,
                            leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null, modifier = Modifier.size(20.dp)) },
                            modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp))
                        Spacer(Modifier.height(10.dp))
                    }
                    Panel(Modifier.fillMaxWidth(), padding = 0.dp) {
                        archived.forEachIndexed { i, v ->
                            if (i > 0) RowDivider(84.dp)
                            ArchivedRow(v) { open(v.id) }
                        }
                        if (archived.isEmpty()) Text("Nessuna auto trovata", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp))
                    }
                }
            }
        }
    }
}

@Composable private fun ArchivedRow(v: Vehicle, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().bouncyClick(onClickLabel = "Apri ${v.name}", onClick = onClick).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        VehiclePhoto(v, Modifier.size(width = 60.dp, height = 44.dp).clip(RoundedCornerShape(10.dp)), iconSize = 34.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(v.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(listOf(if (v.status == "sold") "Venduta" else "Rottamata", v.plate.uppercase(Locale.ITALY)).filter { it.isNotBlank() }.joinToString(" · "),
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, maxLines = 1)
        }
        Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
    }
}

/** A car in the showroom: the photo edge to edge, the name over it and the two facts that matter. */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable private fun VehicleShowcase(
    v: Vehicle, next: DueReminder?, onClick: () -> Unit,
    sharedTransitionScope: SharedTransitionScope, animatedVisibilityScope: AnimatedVisibilityScope, modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(24.dp)
    Column(modifier.fillMaxWidth().clip(shape).background(MaterialTheme.colorScheme.surface).border(1.dp, hairline(), shape)
        .bouncyClick(onClickLabel = "Apri ${v.name}", onClick = onClick)) {
        Box(Modifier.fillMaxWidth().height(210.dp)) {
            with(sharedTransitionScope) {
                VehiclePhoto(v, Modifier.fillMaxSize()
                    .sharedElement(rememberSharedContentState("vehicle-photo-${v.id}"), animatedVisibilityScope,
                        boundsTransform = { _, _ -> tween(420, easing = FastOutSlowInEasing) })
                    .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)))
            }
            Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, .5f to Color.Transparent, 1f to Color.Black.copy(alpha = .78f))))
            if (v.plate.isNotBlank()) VehiclePlate(v.plate, v.vehicleType, v.year, Modifier.align(Alignment.TopEnd).padding(12.dp), compact = true)
            Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 16.dp, vertical = 14.dp)) {
                Text(v.name, color = Color.White, fontSize = 26.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.5).sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val model = listOf("${v.make} ${v.model}".trim(), v.year.takeIf { it > 0 }?.toString().orEmpty()).filter { it.isNotBlank() }.joinToString(" · ")
                if (model.isNotBlank()) Text(model, color = Color.White.copy(alpha = .75f), fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(painterResource(R.drawable.ic_speedometer), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(v.mileage.formatKm(), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, style = Numeric, maxLines = 1)
            Spacer(Modifier.weight(1f))
            if (next != null) StatusPill("${maintenanceLabel(next.maintenance)} · ${reminderStatus(next)}", urgencyFor(next.days).color, Modifier.widthIn(max = 220.dp))
            else StatusPill("Tutto in regola", urgencyFor(365).color)
        }
    }
}

// ───────────────────────── Deadlines ─────────────────────────

/** Every deadline of the active cars, grouped by how close it is. */
@Composable internal fun ReminderScreen(state: GarageState, onBack: () -> Unit, open: (DueReminder) -> Unit) {
    val list = remember(state) { dueReminders(state) }
    val overdue = list.filter { (it.days ?: Long.MAX_VALUE) < 0 }
    val soon = list.filter { it.days != null && it.days in 0..30 }
    val later = list - overdue.toSet() - soon.toSet()
    val multipleCars = list.map { it.vehicle.id }.distinct().size > 1
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { PageTopBar("", onBack, "Garage") }
        item { PageHeading("Agenda", "Scadenze", "Tutti i promemoria delle tue auto attive", Modifier.padding(horizontal = 20.dp).staggerIn(0)) }
        if (list.isEmpty()) item { EmptyState(R.drawable.ic_calendar_nav, "Tutto in regola", "Nessuna scadenza da mostrare. Registra un intervento con promemoria per vederlo qui.", Modifier.padding(horizontal = 18.dp).staggerIn(1)) }
        else item {
            Panel(Modifier.fillMaxWidth().padding(horizontal = 18.dp).staggerIn(1), padding = 16.dp) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Readout("Scadute", Modifier.weight(1f), color = if (overdue.isNotEmpty()) urgencyFor(-1).color else MaterialTheme.colorScheme.onSurface) { AnimatedCount(overdue.size, it) }
                    ReadoutDivider()
                    Readout("Entro 30 giorni", Modifier.weight(1f), color = if (soon.isNotEmpty()) urgencyFor(10).color else MaterialTheme.colorScheme.onSurface) { AnimatedCount(soon.size, it) }
                    ReadoutDivider()
                    Readout("Più avanti", Modifier.weight(1f)) { AnimatedCount(later.size, it) }
                }
            }
        }
        listOf("Scadute" to overdue, "Prossimi 30 giorni" to soon, "Più avanti" to later).forEachIndexed { index, (title, group) ->
            if (group.isNotEmpty()) item(key = "group-$title") {
                Column(Modifier.padding(horizontal = 18.dp).staggerIn(2 + index)) {
                    Overline(title, Modifier.padding(start = 4.dp, bottom = 8.dp))
                    DeadlineGroup(group, showVehicle = multipleCars, onClick = open)
                }
            }
        }
    }
}

// ───────────────────────── Onboarding ─────────────────────────

/** Five steps; a speedometer gauge sweeps forward with each one. Always in the dark cockpit look. */
@Composable internal fun Onboarding(done: () -> Unit) {
    data class Slide(val title: String, val body: String, val icon: Int)
    val slides = listOf(
        Slide("Il tuo garage,\nsempre con te.", "Auto, manutenzioni, documenti e scadenze in un unico spazio privato.", R.drawable.ic_garage_nav),
        Slide("Ogni auto ha\nla sua storia.", "Conserva targa, chilometri, foto e appunti nella scheda del veicolo.", R.drawable.ic_car),
        Slide("Interventi sotto\ncontrollo.", "Registra tagliandi, revisione, bollo, assicurazione e altri lavori.", R.drawable.ic_wrench),
        Slide("Documenti e\nscadenze.", "Archivia i file sul dispositivo e consulta i promemoria quando vuoi.", R.drawable.ic_calendar_nav),
        Slide("Pronto a partire.", "I dati restano disponibili offline. Esporta un backup per portarli con te.", R.drawable.ic_shield)
    )
    var step by remember { mutableIntStateOf(0) }
    val glow by rememberInfiniteTransition(label = "onboarding").animateFloat(.6f, 1f, infiniteRepeatable(tween(2000, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "glow")
    CompositionLocalProvider(LocalGarageDark provides true) {
    MaterialTheme(colorScheme = MaterialTheme.colorScheme.copy(primary = Ice, onSurfaceVariant = Steel, outline = Steel, surface = CarbonPanel, onSurface = Frost)) {
    Column(Modifier.fillMaxSize().background(Carbon).drawBehind {
        val c = Offset(size.width * .5f, size.height * .32f)
        drawCircle(Brush.radialGradient(listOf(Ice.copy(alpha = .14f * glow), Color.Transparent), c, size.width * .9f), size.width * .9f, c)
    }.statusBarsPadding().navigationBarsPadding().padding(horizontal = 26.dp, vertical = 18.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.garage_logo_dark), contentDescription = "Garage", modifier = Modifier.size(40.dp))
            Spacer(Modifier.weight(1f))
            TextButton(onClick = done) { Text("Salta", color = Frost.copy(alpha = .7f)) }
        }
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            Gauge((step + 1) / slides.size.toFloat(), Ice, Modifier.size(230.dp), stroke = 6.dp) {
                Box(Modifier.size(150.dp).clip(CircleShape).background(Brush.radialGradient(listOf(CarbonRaised, Carbon))), contentAlignment = Alignment.Center) {
                    AnimatedContent(step, transitionSpec = {
                        (fadeIn(tween(260, 80)) + androidx.compose.animation.scaleIn(tween(320, easing = FastOutSlowInEasing), initialScale = .7f)) togetherWith fadeOut(tween(140))
                    }, label = "onboarding_icon") { s ->
                        Icon(painterResource(slides[s].icon), contentDescription = null, tint = Ice, modifier = Modifier.size(64.dp))
                    }
                }
                Text("0${step + 1}", color = Frost, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, style = Numeric,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 6.dp))
            }
        }
        AnimatedContent(step, transitionSpec = {
            val forward = targetState > initialState
            (slideInHorizontally(tween(360, easing = FastOutSlowInEasing)) { if (forward) it / 4 else -it / 4 } + fadeIn(tween(300))) togetherWith
                (slideOutHorizontally(tween(220)) { if (forward) -it / 6 else it / 6 } + fadeOut(tween(160)))
        }, label = "onboarding_text") { s ->
            Column {
                Text(slides[s].title, color = Frost, fontSize = 36.sp, fontWeight = FontWeight.Bold, lineHeight = 40.sp, letterSpacing = (-.9).sp)
                Spacer(Modifier.height(12.dp))
                Text(slides[s].body, color = Steel, fontSize = 16.sp, lineHeight = 22.sp, minLines = 2)
            }
        }
        Spacer(Modifier.height(26.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            slides.indices.forEach { i ->
                val width by animateDpAsState(if (i == step) 26.dp else 6.dp, spring(dampingRatio = .7f), label = "dot")
                Box(Modifier.width(width).height(6.dp).clip(CircleShape).background(if (i <= step) Ice else Steel.copy(alpha = .3f))
                    .bouncyClick(role = Role.Tab) { step = i })
            }
        }
        Spacer(Modifier.height(22.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AnimatedVisibility(step > 0, enter = fadeIn() + androidx.compose.animation.expandHorizontally(), exit = fadeOut() + androidx.compose.animation.shrinkHorizontally()) {
                GhostButton(onClick = { step-- }) { Text("Indietro") }
            }
            AccentButton(onClick = { if (step == slides.lastIndex) done() else step++ }, modifier = Modifier.weight(1f)) {
                Text(if (step == slides.lastIndex) "Inizia" else "Continua")
                Spacer(Modifier.width(6.dp))
                Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, modifier = Modifier.size(20.dp))
            }
        }
    }
    }
    }
}

// ───────────────────────── Lock screen ─────────────────────────

@Composable internal fun GarageLockScreen(hasPin: Boolean, pinLength: Int, biometric: Boolean, isDark: Boolean,
    verifyPin: (String) -> Boolean, onUnlocked: () -> Unit, onBiometric: () -> Unit, onLegacyUnlock: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var failures by remember { mutableIntStateOf(0) }
    var blockedUntil by remember { mutableLongStateOf(0L) }
    val shake = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(biometric, hasPin) { if (biometric && hasPin) onBiometric() }
    fun shakeIt() = scope.launch {
        shake.snapTo(0f)
        shake.animateTo(0f, keyframes { durationMillis = 420; -18f at 50; 16f at 120; -12f at 190; 8f at 260; -4f at 330 })
    }
    fun digit(value: Int) {
        if (SystemClock.elapsedRealtime() < blockedUntil) { error = "Riprova tra qualche secondo"; shakeIt(); return }
        if (pin.length >= 8) return
        val candidate = pin + value
        pin = candidate; error = ""
        val shouldCheck = if (pinLength in 4..8) candidate.length == pinLength else candidate.length >= 4
        if (shouldCheck && verifyPin(candidate)) { pin = ""; failures = 0; onUnlocked(); return }
        if ((pinLength in 4..8 && candidate.length == pinLength) || candidate.length == 8) {
            pin = ""; failures++; shakeIt()
            if (failures >= 5) { blockedUntil = SystemClock.elapsedRealtime() + 30_000; failures = 0; error = "Troppi tentativi. Riprova tra 30 secondi" }
            else error = "PIN non corretto"
        }
    }
    val slots = pinLength.takeIf { it in 4..8 } ?: 6
    Column(Modifier.fillMaxSize().cockpitBackdrop().statusBarsPadding().navigationBarsPadding().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Gauge(if (hasPin) pin.length / slots.toFloat() else 0f, MaterialTheme.colorScheme.primary, Modifier.size(108.dp), stroke = 4.dp) {
            Image(painterResource(if (isDark) R.drawable.garage_logo_dark else R.drawable.garage_logo_light), contentDescription = "Garage", modifier = Modifier.size(60.dp))
        }
        Spacer(Modifier.height(18.dp))
        Text("Garage protetto", color = MaterialTheme.colorScheme.onBackground, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.6).sp)
        Spacer(Modifier.height(4.dp))
        Text(if (hasPin) "Inserisci il tuo PIN" else "Usa il blocco schermo del dispositivo", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(26.dp))
        if (hasPin) {
            Row(Modifier.graphicsLayer { translationX = shake.value.dp.toPx() }, horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat(slots) { index ->
                    val filled = index < pin.length
                    val scale by animateFloatAsState(if (filled) 1.2f else 1f, spring(dampingRatio = .4f, stiffness = Spring.StiffnessMedium), label = "pin_dot")
                    Box(Modifier.size(12.dp).graphicsLayer { scaleX = scale; scaleY = scale }.clip(CircleShape)
                        .background(if (filled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .35f)))
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, minLines = 1)
            Spacer(Modifier.height(16.dp))
            listOf(listOf(1, 2, 3), listOf(4, 5, 6), listOf(7, 8, 9)).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    row.forEach { number -> PinKey(number.toString()) { digit(number) } }
                }
                Spacer(Modifier.height(12.dp))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(72.dp), contentAlignment = Alignment.Center) {
                    if (biometric) TextButton(onClick = onBiometric) { Text("Biometria", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                }
                PinKey("0") { digit(0) }
                PinKey("⌫") { if (pin.isNotEmpty()) { pin = pin.dropLast(1); error = "" } }
            }
        } else AccentButton(onClick = onLegacyUnlock, modifier = Modifier.fillMaxWidth()) { Text("Sblocca") }
    }
}

@Composable private fun PinKey(label: String, onClick: () -> Unit) {
    Box(Modifier.size(72.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surface)
        .border(1.dp, hairline(), CircleShape)
        .bouncyClick(onClickLabel = if (label == "⌫") "Cancella cifra" else "Cifra $label", onClick = onClick), contentAlignment = Alignment.Center) {
        Text(label, color = MaterialTheme.colorScheme.onSurface, fontSize = 26.sp, fontWeight = FontWeight.Medium, style = Numeric)
    }
}
