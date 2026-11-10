package it.dueffe.garage

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

/** The sections of a car, each one tab of its single page. */
private val vehicleTabs = listOf(
    "Interventi" to R.drawable.ic_wrench,
    "Scadenze" to R.drawable.ic_calendar_nav,
    "Documenti" to R.drawable.ic_document,
    "Note" to R.drawable.ic_note,
)

/**
 * Everything about one car on a single page: the photo with name and plate, the key numbers, the next
 * deadline and, below, interventions, deadlines, documents and notes as tabs. The button at the
 * bottom adds what the tab shown is about; the rarer actions sit in the menu at the top.
 */
@OptIn(ExperimentalSharedTransitionApi::class, ExperimentalFoundationApi::class)
@Composable internal fun VehiclePage(
    v: Vehicle, state: GarageState, tab: String, setTab: (String) -> Unit, backLabel: String, onBack: () -> Unit,
    onEdit: () -> Unit, onStatus: () -> Unit, onDelete: () -> Unit, onCopyPlate: () -> Unit,
    onAddMaintenance: () -> Unit, onOpenMaintenance: (Maintenance) -> Unit, onOpenReminder: (DueReminder) -> Unit,
    onAddDocument: () -> Unit, onOpenDocument: (GarageDocument) -> Unit, onShareDocument: (GarageDocument) -> Unit,
    onRenameDocument: (GarageDocument) -> Unit, onDeleteDocument: (GarageDocument) -> Unit, onNotes: (String) -> Unit,
    sharedTransitionScope: SharedTransitionScope? = null, animatedVisibilityScope: AnimatedVisibilityScope? = null,
) {
    val maintenances = state.maintenances.filter { it.vehicleId == v.id }.sortedByDescending { it.date }
    val docs = state.documents.filter { it.vehicleId == v.id }.sortedByDescending { it.addedAt }
    val reminders = remember(state, v.id) { dueReminders(state).filter { it.vehicle.id == v.id } }
    var query by remember(v.id, tab) { mutableStateOf("") }
    var typeFilter by remember(v.id) { mutableStateOf("all") }
    var documentFilter by remember(v.id) { mutableStateOf("all") }
    var notes by remember(v.id, v.notes) { mutableStateOf(v.notes) }
    val listState = rememberLazyListState()
    // The button at the bottom hides while scrolling down, to leave the list in sight.
    var lastIndex by remember { mutableIntStateOf(0) }
    var lastOffset by remember { mutableIntStateOf(0) }
    var fabVisible by remember { mutableStateOf(true) }
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset }.collect { (i, o) ->
            val down = i > lastIndex || (i == lastIndex && o > lastOffset + 8)
            val up = i < lastIndex || (i == lastIndex && o < lastOffset - 8)
            if (down) fabVisible = false else if (up) fabVisible = true
            lastIndex = i; lastOffset = o
        }
    }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().imePadding(), state = listState,
            contentPadding = PaddingValues(bottom = 190.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item(key = "hero") {
                VehicleHero(v, backLabel, onBack, onEdit, onStatus, onCopyPlate, onDelete,
                    parallax = { if (listState.firstVisibleItemIndex == 0) listState.firstVisibleItemScrollOffset.toFloat() else 0f })
            }
            item(key = "facts") { VehicleFacts(v, maintenances, Modifier.staggerIn(1)) }
            reminders.firstOrNull()?.let { next ->
                item(key = "next") {
                    Column(Modifier.padding(horizontal = 18.dp).staggerIn(2)) {
                        Text("PROSSIMA SCADENZA", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Black)
                        Spacer(Modifier.height(8.dp))
                        ReminderListCard(next) { onOpenReminder(next) }
                    }
                }
            }
            stickyHeader(key = "tabs") { VehicleTabs(tab, setTab, Modifier.staggerIn(3)) }

            when (tab) {
                "Interventi" -> {
                    if (maintenances.size > 4) item(key = "interventi-filters") {
                        Row(Modifier.animateItem().fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            listOf("all", "service", "inspection", "tax", "insurance", "tires", "custom").forEach { value ->
                                MaintenanceFilterPill(value, typeFilter == value) { typeFilter = value }
                            }
                        }
                    }
                    if (maintenances.size > 8) item(key = "interventi-search") { SearchField(query, "Cerca interventi", Modifier.animateItem()) { query = it } }
                    val filtered = maintenances.filter { (typeFilter == "all" || it.type == typeFilter) && "${maintenanceLabel(it)} ${it.notes} ${it.date}".contains(query, true) }
                    if (filtered.isEmpty()) item(key = "interventi-empty") {
                        Box(Modifier.animateItem().padding(horizontal = 18.dp)) {
                            if (maintenances.isEmpty()) DetailEmptyState("Ancora nessun intervento", "Tagliandi, revisioni, bollo e assicurazione: registrali con il pulsante in basso.", R.drawable.ic_wrench)
                            else DetailEmptyState("Nessun intervento trovato", "Prova un altro filtro.", R.drawable.ic_search)
                        }
                    }
                    items(filtered, key = { "maintenance-${it.id}" }) { m ->
                        Box(Modifier.animateItem().padding(horizontal = 18.dp)) { MaintenanceListCard(m) { onOpenMaintenance(m) } }
                    }
                    if (maintenances.isNotEmpty()) item(key = "interventi-total") {
                        val total = maintenances.sumOf { it.cost }
                        Text("${maintenances.size} ${if (maintenances.size == 1) "intervento" else "interventi"} · ${String.format(Locale.ITALY, "€ %,.2f", total)} in tutto",
                            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
                            modifier = Modifier.animateItem().fillMaxWidth().padding(horizontal = 18.dp, vertical = 4.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                }
                "Scadenze" -> {
                    if (reminders.isEmpty()) item(key = "scadenze-empty") {
                        Box(Modifier.animateItem().padding(horizontal = 18.dp)) {
                            DetailEmptyState("Nessuna scadenza", "Quando registri un intervento puoi aggiungere un promemoria: comparirà qui.", R.drawable.ic_calendar_nav)
                        }
                    }
                    items(reminders, key = { "reminder-${it.reminder.id}" }) { r ->
                        Box(Modifier.animateItem().padding(horizontal = 18.dp)) { ReminderListCard(r) { onOpenReminder(r) } }
                    }
                }
                "Documenti" -> {
                    if (docs.size > 4) item(key = "documenti-filters") {
                        Row(Modifier.animateItem().fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            listOf("all", "insurance", "inspection", "tax", "service", "other").forEach { category ->
                                DocumentFilterPill(category, documentFilter == category) { documentFilter = category }
                            }
                        }
                    }
                    if (docs.size > 8) item(key = "documenti-search") { SearchField(query, "Cerca documenti", Modifier.animateItem()) { query = it } }
                    val filtered = docs.filter { d -> d.name.contains(query, true) && (documentFilter == "all" || documentCategory(d, state.maintenances) == documentFilter) }
                    if (filtered.isEmpty()) item(key = "documenti-empty") {
                        Box(Modifier.animateItem().padding(horizontal = 18.dp)) {
                            if (docs.isEmpty()) DetailEmptyState("Nessun documento", "Libretto, polizza, ricevute: fotografali o scegli un file con il pulsante in basso.", R.drawable.ic_document)
                            else DetailEmptyState("Nessun documento trovato", "Prova un altro filtro.", R.drawable.ic_search)
                        }
                    }
                    items(filtered, key = { "document-${it.id}" }) { d ->
                        Box(Modifier.animateItem().padding(horizontal = 18.dp)) {
                            DocumentListCard(d, documentCategory(d, state.maintenances),
                                onOpen = { onOpenDocument(d) }, onShare = { onShareDocument(d) },
                                onRename = { onRenameDocument(d) }, onDelete = { onDeleteDocument(d) })
                        }
                    }
                }
                else -> item(key = "note-card") {
                    Box(Modifier.animateItem().padding(horizontal = 18.dp)) { GarageNotesCard(v.notesUpdatedAt, notes, { notes = it }) { onNotes(notes) } }
                }
            }
        }

        // What the tab is about, added from the bottom: interventions (and their deadlines) or documents.
        val action = when (tab) {
            "Interventi" -> "Nuovo intervento" to onAddMaintenance
            "Scadenze" -> "Nuova scadenza" to onAddMaintenance
            "Documenti" -> "Nuovo documento" to onAddDocument
            else -> null
        }
        AnimatedVisibility(
            visible = action != null && fabVisible,
            // Sopra la barra di navigazione del garage, che resta visibile anche qui.
            modifier = Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(end = 18.dp, bottom = 104.dp),
            enter = scaleIn(spring(dampingRatio = .55f, stiffness = Spring.StiffnessMedium), initialScale = .4f) + fadeIn(),
            exit = scaleOut(tween(160), targetScale = .6f) + fadeOut(tween(140)),
        ) {
            var shown by remember { mutableStateOf(action) }
            if (action != null) shown = action
            shown?.let { (label, onClick) ->
                GradientButton(onClick = onClick, modifier = Modifier.height(58.dp), shape = RoundedCornerShape(29.dp),
                    contentPadding = PaddingValues(horizontal = 22.dp), shine = true) {
                    Text("＋", fontSize = 24.sp, lineHeight = 24.sp, fontWeight = FontWeight.Light)
                    Spacer(Modifier.width(8.dp))
                    AnimatedContent(label, transitionSpec = {
                        (slideInVertically { it } + fadeIn()) togetherWith (slideOutVertically { -it } + fadeOut())
                    }, label = "fab_label") { Text(it, fontWeight = FontWeight.Black, fontSize = 15.sp) }
                }
            }
        }
    }
}

/** The photo (or a warm gradient with the car outline), with the name, plate, back button and menu. */
@Composable private fun VehicleHero(
    v: Vehicle, backLabel: String, onBack: () -> Unit, onEdit: () -> Unit, onStatus: () -> Unit,
    onCopyPlate: () -> Unit, onDelete: () -> Unit, parallax: () -> Float,
) {
    val statusLabel = when (v.status) { "sold" -> "Venduta"; "scrapped" -> "Rottamata"; else -> "Attiva" }
    Box(Modifier.fillMaxWidth().height(if (v.photo != null) 340.dp else 300.dp)
        .clip(RoundedCornerShape(bottomStart = 34.dp, bottomEnd = 34.dp))) {
        Box(Modifier.matchParentSize().graphicsLayer { translationY = parallax() * .45f }) {
            if (v.photo != null) VehicleImage(v.photo, Modifier.fillMaxSize())
            else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF3A2E1C), Color(0xFF12100D))))
                .drawBehind {
                    drawCircle(Brush.radialGradient(listOf(Gold.copy(alpha = .35f), Color.Transparent), Offset(size.width * .82f, size.height * .3f), size.width * .6f),
                        size.width * .6f, Offset(size.width * .82f, size.height * .3f))
                }) {
                Icon(painterResource(R.drawable.ic_car), contentDescription = null, tint = Gold.copy(alpha = .25f),
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 18.dp).size(150.dp).rotate(-8f))
            }
        }
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Black.copy(alpha = .45f), .28f to Color.Transparent, .55f to Color.Transparent, 1f to Color.Black.copy(alpha = .82f))))
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            GlassIconButton(R.drawable.ic_arrow_back, "Torna a $backLabel", onBack)
            Spacer(Modifier.weight(1f))
            Box {
                var menu by remember { mutableStateOf(false) }
                GlassIconButton(R.drawable.ic_more, "Altre azioni") { menu = true }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, shape = RoundedCornerShape(18.dp)) {
                    MenuEntry("Modifica auto", R.drawable.ic_edit) { menu = false; onEdit() }
                    MenuEntry("Cambia stato", R.drawable.ic_car) { menu = false; onStatus() }
                    MenuEntry("Copia targa", R.drawable.ic_copy) { menu = false; onCopyPlate() }
                    HorizontalDivider()
                    MenuEntry("Elimina auto", R.drawable.ic_delete, destructive = true) { menu = false; onDelete() }
                }
            }
        }
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 20.dp, vertical = 18.dp).staggerIn(0)) {
            Row(Modifier.background(Color.Black.copy(alpha = .45f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(if (v.status == "active") Color(0xFF2AD06D) else Color(0xFFB4B1AA), CircleShape))
                Spacer(Modifier.width(6.dp))
                Text("$statusLabel · ${vehicleTypeLabel(v.vehicleType)}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(8.dp))
            Text(v.name, color = Color.White, fontSize = 34.sp, lineHeight = 37.sp, fontWeight = FontWeight.Black, letterSpacing = (-.6).sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val model = "${v.make} ${v.model}".trim()
            if (model.isNotBlank()) Text(model, color = Color.White.copy(alpha = .8f), fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (v.plate.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                VehiclePlate(v.plate, v.vehicleType, v.registrationDate.take(4).toIntOrNull() ?: v.year, compact = true)
            }
        }
    }
}

/** The key numbers of the car in a row of soft chips: kilometres, fuel, year, money spent. */
@Composable private fun VehicleFacts(v: Vehicle, maintenances: List<Maintenance>, modifier: Modifier = Modifier) {
    val spent = maintenances.sumOf { it.cost }
    val facts = buildList {
        add(Triple(R.drawable.ic_speedometer, v.mileage.formatKm(), "Chilometri"))
        if (v.fuel.isNotBlank()) add(Triple(R.drawable.ic_fuel, v.fuel, "Carburante"))
        if (v.year > 0) add(Triple(R.drawable.ic_calendar_nav, v.year.toString(), "Anno"))
        add(Triple(R.drawable.ic_coins, String.format(Locale.ITALY, "€ %,.0f", spent), "Spesi"))
    }
    Row(modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        facts.forEach { (icon, value, label) ->
            Row(Modifier.clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.surface)
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .12f), RoundedCornerShape(20.dp))
                .padding(start = 10.dp, end = 16.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer), contentAlignment = Alignment.Center) {
                    Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(19.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(value, fontSize = 15.sp, fontWeight = FontWeight.Black, maxLines = 1)
                    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, maxLines = 1)
                }
            }
        }
    }
}

/** The four sections as large, readable tabs with a sliding pill; it stays on top while scrolling. */
@Composable private fun VehicleTabs(tab: String, setTab: (String) -> Unit, modifier: Modifier = Modifier) {
    val dark = LocalGarageDark.current
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Box(modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background.copy(alpha = .94f)).padding(horizontal = 18.dp, vertical = 8.dp)) {
        BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp)).background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .14f), RoundedCornerShape(26.dp)).padding(4.dp)) {
            val segment = maxWidth / vehicleTabs.size
            val index = vehicleTabs.indexOfFirst { it.first == tab }.coerceAtLeast(0)
            val x by animateDpAsState(segment * index, spring(dampingRatio = .7f, stiffness = Spring.StiffnessMediumLow), label = "tab_pill")
            Box(Modifier.offset(x = x).width(segment).height(56.dp).clip(RoundedCornerShape(22.dp)).background(accentGradient()))
            Row(Modifier.fillMaxWidth().selectableGroup()) {
                vehicleTabs.forEach { (label, icon) ->
                    val selected = label == tab
                    val onAccent = if (dark) Black else Color.White
                    val tint by animateColorAsState(if (selected) onAccent else muted, tween(250), label = "tab_tint")
                    val scale by androidx.compose.animation.core.animateFloatAsState(if (selected) 1.1f else 1f, spring(dampingRatio = .45f), label = "tab_icon")
                    Column(Modifier.weight(1f).height(56.dp).clip(RoundedCornerShape(22.dp))
                        .selectable(selected, role = Role.Tab) { setTab(label) },
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(painterResource(icon), contentDescription = null, tint = tint, modifier = Modifier.size(21.dp).graphicsLayer { scaleX = scale; scaleY = scale })
                        Spacer(Modifier.height(2.dp))
                        Text(label, color = tint, fontSize = 12.sp, fontWeight = if (selected) FontWeight.Black else FontWeight.Medium, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable private fun GlassIconButton(icon: Int, description: String, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).background(Color.Black.copy(alpha = .4f))
        .border(1.dp, Color.White.copy(alpha = .18f), CircleShape)
        .bouncyClick(onClickLabel = description, role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(painterResource(icon), contentDescription = description, tint = Color.White, modifier = Modifier.size(22.dp))
    }
}

@Composable private fun MenuEntry(label: String, icon: Int, destructive: Boolean = false, onClick: () -> Unit) {
    val color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    DropdownMenuItem(text = { Text(label, color = color, fontWeight = FontWeight.SemiBold) }, onClick = onClick,
        leadingIcon = { Icon(painterResource(icon), contentDescription = null, tint = color, modifier = Modifier.size(20.dp)) })
}

@Composable private fun SearchField(value: String, placeholder: String, modifier: Modifier, onChange: (String) -> Unit) {
    OutlinedTextField(value, onChange, placeholder = { Text(placeholder) },
        leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null, modifier = Modifier.size(22.dp)) },
        modifier = modifier.fillMaxWidth().padding(horizontal = 18.dp), singleLine = true, shape = RoundedCornerShape(18.dp))
}
