package it.dueffe.garage

import android.graphics.BitmapFactory
import android.os.SystemClock
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.BoundsTransform
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

// ───────────────────────── Navigation bar ─────────────────────────

@Composable internal fun FloatingGarageNavigation(page: String, modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
    val destinations = listOf(Triple("garage", "Garage", R.drawable.ic_garage_nav), Triple("scadenze", "Scadenze", R.drawable.ic_calendar_nav), Triple("impostazioni", "Impostazioni", R.drawable.ic_settings_nav))
    val dark = LocalGarageDark.current
    val shape = RoundedCornerShape(34.dp)
    Box(modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 22.dp, vertical = 10.dp)) {
        BoxWithConstraints(Modifier.fillMaxWidth().shadow(24.dp, shape, spotColor = if (dark) Gold.copy(alpha = .35f) else Color.Black.copy(alpha = .3f))
            .clip(shape).background(MaterialTheme.colorScheme.surface.copy(alpha = .97f))
            .border(1.dp, if (dark) Color.White.copy(alpha = .08f) else Color.Black.copy(alpha = .05f), shape).padding(6.dp)) {
            val segment = maxWidth / destinations.size
            val selectedIndex = destinations.indexOfFirst { it.first == page }.coerceAtLeast(0)
            val indicatorX by animateDpAsState(segment * selectedIndex, spring(dampingRatio = .68f, stiffness = Spring.StiffnessMediumLow), label = "bottom_navigation_pill")
            Box(Modifier.offset(x = indicatorX).width(segment).height(58.dp).clip(RoundedCornerShape(28.dp)).background(accentGradient()))
            Row(Modifier.fillMaxWidth().selectableGroup()) {
                destinations.forEach { (key, label, icon) ->
                    val selected = key == page
                    val interaction = remember { MutableInteractionSource() }
                    val tint by animateColorAsState(if (selected) (if (dark) Black else Color.White) else MaterialTheme.colorScheme.onSurfaceVariant, tween(250), label = "nav_tint")
                    val iconScale by animateFloatAsState(if (selected) 1.12f else 1f, spring(dampingRatio = .4f, stiffness = Spring.StiffnessMedium), label = "nav_icon")
                    val lift by animateDpAsState(if (selected) (-1).dp else 0.dp, spring(dampingRatio = .5f), label = "nav_lift")
                    Column(Modifier.weight(1f).height(58.dp).clip(RoundedCornerShape(28.dp)).pressScale(interaction, .9f)
                        .selectable(selected = selected, interactionSource = interaction, indication = null, role = Role.Tab, onClick = { onSelect(key) }),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(painterResource(icon), contentDescription = null, tint = tint,
                            modifier = Modifier.offset(y = lift).size(23.dp).graphicsLayer { scaleX = iconScale; scaleY = iconScale })
                        Spacer(Modifier.height(3.dp))
                        Text(label, color = tint, fontSize = 11.sp, fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Medium, maxLines = 1)
                    }
                }
            }
        }
    }
}

// ───────────────────────── Shared bits ─────────────────────────

@Composable internal fun SectionHeading(kicker: String, title: String, subtitle: String = "") {
    Column(Modifier.padding(bottom = 8.dp).staggerIn(0)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(18.dp).height(3.dp).clip(CircleShape).background(accentGradient()))
            Spacer(Modifier.width(8.dp))
            Text(kicker.uppercase(Locale.ITALY), color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, letterSpacing = 2.4.sp, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.height(6.dp))
        Text(title, fontSize = 34.sp, lineHeight = 37.sp, fontWeight = FontWeight.Black, letterSpacing = (-.6).sp)
        if (subtitle.isNotBlank()) { Spacer(Modifier.height(3.dp)); Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp) }
    }
}

@Composable internal fun InfoCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) = GlassCard(modifier, content = content)

@Composable internal fun VehicleImage(data: ByteArray?, modifier: Modifier = Modifier) {
    val bitmap = remember(data) { data?.let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } }
    if (bitmap != null) Box(modifier.clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
        Image(BitmapPainter(bitmap), contentDescription = "Foto auto", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
    }
}

@Composable private fun EmptyIllustration(icon: Int, title: String, subtitle: String, modifier: Modifier = Modifier) {
    val float = rememberInfiniteTransition(label = "empty")
    val bob by float.animateFloat(-6f, 6f, infiniteRepeatable(tween(1800, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "bob")
    GlassCard(modifier.fillMaxWidth(), padding = 26.dp) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(96.dp).graphicsLayer { translationY = bob.dp.toPx() }, contentAlignment = Alignment.Center) {
                Box(Modifier.matchParentSize().clip(CircleShape).background(Brush.radialGradient(listOf(Gold.copy(alpha = .35f), Color.Transparent))))
                GradientIcon(icon, 64.dp, 32.dp)
            }
            Spacer(Modifier.height(14.dp))
            Text(title, fontSize = 21.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
            Spacer(Modifier.height(4.dp))
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, textAlign = TextAlign.Center, lineHeight = 19.sp)
        }
    }
}

// ───────────────────────── Home ─────────────────────────

private var homeIntroPlayed = false

private fun greeting(): String = when (LocalTime.now().hour) { in 5..12 -> "Buongiorno"; in 13..17 -> "Buon pomeriggio"; else -> "Buonasera" }

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable internal fun GarageHome(state: GarageState, add: () -> Unit, open: (String) -> Unit, sharedTransitionScope: SharedTransitionScope, animatedVisibilityScope: AnimatedVisibilityScope) {
    var archive by remember { mutableStateOf(false) }; var query by remember { mutableStateOf("") }
    val active = state.vehicles.filter { it.status == "active" }
    val archived = state.vehicles.filter { it.status != "active" && "${it.name} ${it.make} ${it.plate}".contains(query, true) }
    val due = remember(state) { dueReminders(state) }
    val year = LocalDate.now().year.toString()
    val spent = state.maintenances.filter { it.date.startsWith(year) }.sumOf { it.cost }
    val soon = due.count { (it.days ?: Long.MAX_VALUE) <= 30 }
    val intro = remember { !homeIntroPlayed }
    LaunchedEffect(Unit) { homeIntroPlayed = true }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Column(Modifier.staggerIn(0, enabled = intro)) {
                Text(LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.ITALY)).uppercase(Locale.ITALY),
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("${greeting()},", fontSize = 20.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                GradientText("il tuo garage", 40.sp)
            }
        }
        item {
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).staggerIn(1, enabled = intro), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(R.drawable.ic_car, active.size, if (active.size == 1) "Auto attiva" else "Auto attive", Modifier.weight(1f), animate = intro)
                StatTile(R.drawable.ic_clock, soon, "Entro 30 gg", Modifier.weight(1f), highlight = soon > 0, animate = intro)
                StatTile(R.drawable.ic_coins, spent, "Spesi nel $year", Modifier.weight(1f), money = true, animate = intro)
            }
        }
        due.firstOrNull()?.let { next -> item { NextDeadlineCard(next, Modifier.staggerIn(2, enabled = intro)) { open(next.vehicle.id) } } }
        item {
            val launchModifier = Modifier.containerTransform("add-vehicle-page", sharedTransitionScope, animatedVisibilityScope)
            GradientButton(onClick = add, modifier = Modifier.fillMaxWidth().height(58.dp).staggerIn(3, enabled = intro).then(launchModifier), shine = true) {
                Text("＋", fontSize = 26.sp, lineHeight = 26.sp, fontWeight = FontWeight.Light)
                Spacer(Modifier.width(9.dp))
                Text("Aggiungi auto", fontSize = 16.sp, fontWeight = FontWeight.Black)
            }
        }
        if (active.isEmpty()) item {
            EmptyIllustration(R.drawable.ic_garage_nav,
                if (state.vehicles.isEmpty()) "Il garage è pronto" else "Nessuna auto attiva",
                if (state.vehicles.isEmpty()) "Aggiungi la tua prima auto per iniziare a tenere tutto sotto controllo." else "Aggiungi un'auto o consulta l'archivio.",
                Modifier.staggerIn(4, enabled = intro))
        }
        else item {
            Text("LE TUE AUTO", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.padding(top = 4.dp).staggerIn(4, enabled = intro))
        }
        itemsIndexed(active, key = { _, v -> v.id }) { index, v ->
            VehicleCard(v, due.filter { it.vehicle.id == v.id }, open, sharedTransitionScope, animatedVisibilityScope, Modifier.staggerIn(5 + index, enabled = intro))
        }
        if (state.vehicles.any { it.status != "active" }) {
            item {
                TextButton(onClick = { archive = !archive }) {
                    val rotation by animateFloatAsState(if (archive) 180f else 0f, spring(dampingRatio = .6f), label = "archive_chevron")
                    Icon(painterResource(R.drawable.ic_chevron_down), contentDescription = null, modifier = Modifier.size(18.dp).rotate(rotation))
                    Spacer(Modifier.width(6.dp))
                    Text(if (archive) "Nascondi archivio" else "Mostra archivio (${state.vehicles.size - active.size})", fontWeight = FontWeight.Bold)
                }
            }
            if (archive) {
                item { OutlinedTextField(query, { query = it }, label = { Text("Cerca nell'archivio") }, modifier = Modifier.fillMaxWidth().staggerIn(0, enabled = intro), shape = RoundedCornerShape(18.dp)) }
                itemsIndexed(archived, key = { _, v -> v.id }) { index, v -> VehicleCard(v, emptyList(), open, sharedTransitionScope, animatedVisibilityScope, Modifier.staggerIn(index + 1, enabled = intro)) }
            }
        }
    }
}

@Composable private fun StatTile(icon: Int, value: Number, label: String, modifier: Modifier = Modifier, highlight: Boolean = false, money: Boolean = false, animate: Boolean = true) {
    val dark = LocalGarageDark.current
    val shape = RoundedCornerShape(22.dp)
    Column(
        modifier.fillMaxHeight().clip(shape)
            .background(if (highlight) Brush.linearGradient(listOf(Amber.copy(alpha = if (dark) .30f else .22f), Ember.copy(alpha = if (dark) .16f else .10f)))
                else Brush.linearGradient(listOf(MaterialTheme.colorScheme.surface, MaterialTheme.colorScheme.surface)))
            .border(1.dp, if (highlight) Amber.copy(alpha = .45f) else MaterialTheme.colorScheme.outline.copy(alpha = .12f), shape)
            .padding(horizontal = 12.dp, vertical = 13.dp)
    ) {
        Icon(painterResource(icon), contentDescription = null, tint = if (highlight) Amber else MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(10.dp))
        AnimatedCount(value, androidx.compose.ui.text.TextStyle(fontSize = if (money) 22.sp else 26.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface),
            animate = animate, format = if (money) { v -> String.format(Locale.ITALY, "€%,.0f", v) } else { v -> String.format(Locale.ITALY, "%d", v.toLong()) })
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable private fun NextDeadlineCard(item: DueReminder, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val urgency = urgencyFor(item.days)
    val appearance = maintenanceAppearance(item.maintenance.type)
    val shape = RoundedCornerShape(26.dp)
    val days = item.days
    val fraction = when { days == null -> 0f; days <= 0 -> 1f; else -> (1f - days / 365f).coerceIn(.05f, 1f) }
    Row(
        modifier.fillMaxWidth().clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xFF221D16), Color(0xFF0E0C0A))))
            .border(1.dp, urgency.color.copy(alpha = .4f), shape)
            .bouncyClick(onClickLabel = "Apri auto", onClick = onClick)
            .drawBehind { drawCircle(Brush.radialGradient(listOf(urgency.color.copy(alpha = .28f), Color.Transparent), Offset(size.width, 0f), size.height * 1.4f), size.height * 1.4f, Offset(size.width, 0f)) }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ProgressRing(fraction, urgency.color, Modifier.size(64.dp), stroke = 5.dp) {
            Icon(painterResource(appearance.icon), contentDescription = null, tint = urgency.color, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text("PROSSIMA SCADENZA", color = Gold, fontSize = 10.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(2.dp))
            Text(maintenanceLabel(item.maintenance), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(item.vehicle.name, color = Color.White.copy(alpha = .65f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(reminderStatus(item), color = urgency.color, fontSize = 14.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.End)
            val date = reminderDueDate(item)
            if (date.isNotBlank()) Text(dateLabel(date), color = Color.White.copy(alpha = .55f), fontSize = 11.sp)
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable private fun VehicleCard(v: Vehicle, due: List<DueReminder>, open: (String) -> Unit, sharedTransitionScope: SharedTransitionScope, animatedVisibilityScope: AnimatedVisibilityScope, modifier: Modifier = Modifier) {
    val statusLabel = when (v.status) { "sold" -> "Venduta"; "scrapped" -> "Rottamata"; else -> "Attiva" }
    val accent = MaterialTheme.colorScheme.primary
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val dark = LocalGarageDark.current
    val shape = RoundedCornerShape(28.dp)
    val next = due.firstOrNull()
    Column(
        modifier.fillMaxWidth()
            .containerTransform("vehicle-page-${v.id}", sharedTransitionScope, animatedVisibilityScope)
            .shadow(if (dark) 0.dp else 14.dp, shape, spotColor = Color.Black.copy(alpha = .25f))
            .clip(shape).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (dark) Color.White.copy(alpha = .07f) else Color.Transparent, shape)
            .bouncyClick(onClickLabel = "Apri ${v.name}") { open(v.id) }
            .padding(8.dp)
    ) {
        Box(Modifier.fillMaxWidth().height(if (v.photo != null) 196.dp else 150.dp).clip(RoundedCornerShape(22.dp))) {
            if (v.photo != null) {
                VehicleImage(v.photo, Modifier.fillMaxSize())
            } else {
                Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF2E2820), Color(0xFF12100D))))
                    .drawBehind { drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .30f), Color.Transparent), Offset(size.width * .85f, size.height * .2f), size.width * .5f), size.width * .5f, Offset(size.width * .85f, size.height * .2f)) }) {
                    Icon(painterResource(R.drawable.ic_car), contentDescription = null, tint = Gold.copy(alpha = .22f),
                        modifier = Modifier.align(Alignment.CenterEnd).padding(end = 14.dp).size(118.dp).rotate(-8f))
                }
            }
            val overlayModifier = Modifier
            Box(Modifier.matchParentSize().then(overlayModifier).background(Brush.verticalGradient(0f to Color.Transparent, .45f to Color.Transparent, 1f to Color.Black.copy(alpha = .78f))))
            Row(Modifier.align(Alignment.TopStart).padding(10.dp).then(overlayModifier).background(Color.Black.copy(alpha = .55f), RoundedCornerShape(50)).padding(horizontal = 11.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(if (v.status == "active") Color(0xFF2AD06D) else Color(0xFFB4B1AA), CircleShape))
                Spacer(Modifier.width(6.dp))
                Text(statusLabel, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Text(v.plate.uppercase(Locale.ITALY), color = Color(0xFF151515), fontSize = 12.sp, letterSpacing = 1.6.sp, fontWeight = FontWeight.Black,
                modifier = Modifier.align(Alignment.TopEnd).padding(10.dp).then(overlayModifier).clip(RoundedCornerShape(6.dp)).background(Color(0xFFF7F7F2))
                    .drawBehind { drawRect(Color(0xFF0755AD), size = androidx.compose.ui.geometry.Size(6.dp.toPx(), size.height)) }
                    .padding(start = 12.dp, end = 8.dp, top = 4.dp, bottom = 4.dp))
            Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 14.dp, vertical = 12.dp)) {
                Text(v.name, color = Color.White, fontSize = 27.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis, letterSpacing = (-.4).sp)
                Text(listOf("${v.make} ${v.model}".trim(), v.year.toString()).filter { it.isNotBlank() }.joinToString(" · "), color = Color.White.copy(alpha = .78f), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = overlayModifier)
            }
        }
        Row(Modifier.fillMaxWidth().padding(start = 10.dp, end = 6.dp, top = 12.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(painterResource(R.drawable.ic_speedometer), contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text(v.mileage.formatKm(), color = muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            if (v.fuel.isNotBlank()) {
                Spacer(Modifier.width(12.dp))
                Icon(painterResource(R.drawable.ic_fuel), contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(v.fuel, color = muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            }
            Spacer(Modifier.weight(1f))
            if (next != null) {
                val urgency = urgencyFor(next.days)
                Row(Modifier.clip(RoundedCornerShape(50)).background(urgency.color.copy(alpha = .14f)).padding(horizontal = 9.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(6.dp).background(urgency.color, CircleShape))
                    Spacer(Modifier.width(5.dp))
                    Text(reminderStatus(next), color = urgency.color, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                }
            } else Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, tint = muted, modifier = Modifier.size(20.dp))
        }
    }
}

// ───────────────────────── Deadlines ─────────────────────────

@Composable internal fun ReminderScreen(state: GarageState, open: (String) -> Unit) {
    val list = remember(state) { dueReminders(state) }
    val overdue = list.filter { (it.days ?: Long.MAX_VALUE) < 0 }
    val soon = list.filter { it.days != null && it.days in 0..30 }
    val later = list - overdue.toSet() - soon.toSet()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { SectionHeading("Agenda", "Scadenze", "Tutti i promemoria delle tue auto attive") }
        if (list.isEmpty()) item { EmptyIllustration(R.drawable.ic_calendar_nav, "Tutto in regola", "Nessuna scadenza da mostrare. Registra un intervento con promemoria per vederlo qui.", Modifier.staggerIn(1)) }
        else item {
            GlassCard(Modifier.fillMaxWidth().staggerIn(1), padding = 16.dp) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    ProgressRing(if (list.isEmpty()) 0f else (list.size - overdue.size).toFloat() / list.size, urgencyFor(200).color, Modifier.size(70.dp), stroke = 7.dp) {
                        AnimatedCount(list.size, androidx.compose.ui.text.TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurface))
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        SummaryLine(urgencyFor(-1).color, "Scadute", overdue.size)
                        SummaryLine(urgencyFor(10).color, "Entro 30 giorni", soon.size)
                        SummaryLine(urgencyFor(200).color, "Più avanti", later.size)
                    }
                }
            }
        }
        var offset = 2
        listOf("Scadute" to overdue, "Prossimi 30 giorni" to soon, "Più avanti" to later).forEach { (title, group) ->
            if (group.isNotEmpty()) {
                val base = offset
                offset += group.size + 1
                item(key = "header-$title") { Text(title.uppercase(Locale.ITALY), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, letterSpacing = 2.sp,
                    fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 8.dp).staggerIn(base)) }
                itemsIndexed(group, key = { _, it -> it.reminder.id }) { i, item -> ReminderListCard(item, Modifier.staggerIn(base + 1 + i), showVehicle = true) { open(item.vehicle.id) } }
            }
        }
    }
}

@Composable private fun SummaryLine(color: Color, label: String, count: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).background(color, CircleShape))
        Spacer(Modifier.width(8.dp))
        Text(label, modifier = Modifier.weight(1f), fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(count.toString(), fontSize = 15.sp, fontWeight = FontWeight.Black, color = if (count > 0) color else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ───────────────────────── Onboarding ─────────────────────────

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
    val transition = rememberInfiniteTransition(label = "onboarding")
    val spin by transition.animateFloat(0f, 360f, infiniteRepeatable(tween(14000, easing = LinearEasing)), label = "spin")
    val bob by transition.animateFloat(-8f, 8f, infiniteRepeatable(tween(2200, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "bob")
    val glow by transition.animateFloat(.55f, 1f, infiniteRepeatable(tween(1600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "glow")
    CompositionLocalProvider(LocalGarageDark provides true) {
    Column(Modifier.fillMaxSize().background(Black).drawBehind {
        drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .16f * glow), Color.Transparent), Offset(size.width * .5f, size.height * .3f), size.width), size.width, Offset(size.width * .5f, size.height * .3f))
        drawCircle(Brush.radialGradient(listOf(Ember.copy(alpha = .10f), Color.Transparent), Offset(0f, size.height), size.width * .9f), size.width * .9f, Offset(0f, size.height))
    }.statusBarsPadding().navigationBarsPadding().padding(28.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.garage_logo_dark), contentDescription = "Garage", modifier = Modifier.size(44.dp))
            Spacer(Modifier.weight(1f))
            TextButton(onClick = done) { Text("Salta", color = Cream.copy(alpha = .7f)) }
        }
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            Box(Modifier.size(220.dp).graphicsLayer { translationY = bob.dp.toPx() }, contentAlignment = Alignment.Center) {
                Box(Modifier.matchParentSize().rotate(spin).drawBehind {
                    drawCircle(Brush.sweepGradient(listOf(Gold, Amber, Ember, Color.Transparent, Gold)), style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx()))
                })
                Box(Modifier.size(170.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFF2A2318), Color(0xFF110E0A)))))
                AnimatedContent(step, transitionSpec = {
                    (scaleIn(spring(dampingRatio = .5f, stiffness = Spring.StiffnessLow), initialScale = .3f) + fadeIn(tween(220))) togetherWith fadeOut(tween(120))
                }, label = "onboarding_icon") { s ->
                    Icon(painterResource(slides[s].icon), contentDescription = null, tint = Gold, modifier = Modifier.size(84.dp))
                }
            }
        }
        AnimatedContent(step, transitionSpec = {
            val forward = targetState > initialState
            (slideInHorizontally(spring(dampingRatio = .85f, stiffness = Spring.StiffnessLow)) { if (forward) it / 3 else -it / 3 } + fadeIn(tween(260))) togetherWith
                (slideOutHorizontally(tween(200)) { if (forward) -it / 4 else it / 4 } + fadeOut(tween(160)))
        }, label = "onboarding_text") { s ->
            Column {
                Text("0${s + 1} / 05", color = Gold, letterSpacing = 2.sp, fontWeight = FontWeight.Black, fontSize = 12.sp)
                Spacer(Modifier.height(12.dp))
                Text(slides[s].title, color = Cream, fontSize = 38.sp, fontWeight = FontWeight.Black, lineHeight = 41.sp, letterSpacing = (-.8).sp)
                Spacer(Modifier.height(14.dp))
                Text(slides[s].body, color = Muted, fontSize = 16.sp, lineHeight = 22.sp, minLines = 2)
            }
        }
        Spacer(Modifier.height(26.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            slides.indices.forEach { i ->
                val width by animateDpAsState(if (i == step) 28.dp else 8.dp, spring(dampingRatio = .6f), label = "dot")
                Box(Modifier.width(width).height(8.dp).clip(CircleShape).background(if (i == step) GoldGradient else Brush.linearGradient(listOf(Muted.copy(alpha = .35f), Muted.copy(alpha = .35f))))
                    .bouncyClick(role = Role.Tab) { step = i })
            }
        }
        Spacer(Modifier.height(22.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AnimatedVisibility(step > 0, enter = fadeIn() + expandHorizontallyCompat(), exit = fadeOut() + shrinkHorizontallyCompat()) {
                OutlinedButton(onClick = { step-- }, modifier = Modifier.height(56.dp), shape = RoundedCornerShape(28.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Cream.copy(alpha = .25f))) { Text("Indietro", color = Cream) }
            }
            GradientButton(onClick = { if (step == slides.lastIndex) done() else step++ }, modifier = Modifier.weight(1f).height(56.dp), shine = step == slides.lastIndex) {
                Text(if (step == slides.lastIndex) "Inizia subito" else "Continua", fontSize = 16.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.width(6.dp))
                Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, modifier = Modifier.size(20.dp))
            }
        }
    }
    }
}

private fun expandHorizontallyCompat() = androidx.compose.animation.expandHorizontally(spring(dampingRatio = .8f))
private fun shrinkHorizontallyCompat() = androidx.compose.animation.shrinkHorizontally(tween(180))

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
    val transition = rememberInfiniteTransition(label = "lock")
    val halo by transition.animateFloat(.9f, 1.08f, infiniteRepeatable(tween(1800, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "halo")
    Column(Modifier.fillMaxSize().garageBackdrop().statusBarsPadding().navigationBarsPadding().padding(horizontal = 26.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Box(Modifier.size(110.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.matchParentSize().graphicsLayer { scaleX = halo; scaleY = halo }.clip(CircleShape)
                .background(Brush.radialGradient(listOf(Gold.copy(alpha = .35f), Color.Transparent))))
            Image(painterResource(if (isDark) R.drawable.garage_logo_dark else R.drawable.garage_logo_light), contentDescription = "Garage", modifier = Modifier.size(74.dp))
        }
        Spacer(Modifier.height(14.dp))
        Text("Garage protetto", color = MaterialTheme.colorScheme.onBackground, fontSize = 31.sp, fontWeight = FontWeight.Black, letterSpacing = (-.5).sp)
        Spacer(Modifier.height(5.dp))
        Text(if (hasPin) "Inserisci il tuo PIN" else "Usa il blocco schermo del dispositivo", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(25.dp))
        if (hasPin) {
            Row(Modifier.graphicsLayer { translationX = shake.value.dp.toPx() }, horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat((pinLength.takeIf { it in 4..8 } ?: 6)) { index ->
                    val filled = index < pin.length
                    val scale by animateFloatAsState(if (filled) 1.25f else 1f, spring(dampingRatio = .35f, stiffness = Spring.StiffnessMedium), label = "pin_dot")
                    Box(Modifier.size(13.dp).graphicsLayer { scaleX = scale; scaleY = scale }.clip(CircleShape)
                        .background(if (filled) accentGradient() else Brush.linearGradient(listOf(MaterialTheme.colorScheme.outline.copy(alpha = .4f), MaterialTheme.colorScheme.outline.copy(alpha = .4f)))))
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, minLines = 1)
            Spacer(Modifier.height(18.dp))
            listOf(listOf(1, 2, 3), listOf(4, 5, 6), listOf(7, 8, 9)).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    row.forEach { number -> PinKey(number.toString()) { digit(number) } }
                }
                Spacer(Modifier.height(12.dp))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(70.dp), contentAlignment = Alignment.Center) {
                    if (biometric) TextButton(onClick = onBiometric) { Text("Bio", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                }
                PinKey("0") { digit(0) }
                PinKey("⌫") { if (pin.isNotEmpty()) { pin = pin.dropLast(1); error = "" } }
            }
        } else GradientButton(onClick = onLegacyUnlock, modifier = Modifier.fillMaxWidth().height(54.dp)) { Text("Sblocca") }
    }
}

@Composable private fun PinKey(label: String, onClick: () -> Unit) {
    val dark = LocalGarageDark.current
    Box(Modifier.size(70.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surface)
        .border(1.dp, if (dark) Color.White.copy(alpha = .07f) else Color.Black.copy(alpha = .06f), CircleShape)
        .bouncyClick(onClickLabel = if (label == "⌫") "Cancella cifra" else "Cifra $label", onClick = onClick), contentAlignment = Alignment.Center) {
        Text(label, color = MaterialTheme.colorScheme.onSurface, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
    }
}
