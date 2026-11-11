package it.dueffe.garage

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Everything about one car on a single scrolling page, no tabs: the photo with name and plate, the
 * instrument cluster, then deadlines, the service history, documents and notes one after the other.
 * The dock at the bottom adds an intervention or a document; rarer actions sit in the menu at the top.
 */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable internal fun VehiclePage(
    v: Vehicle, state: GarageState, backLabel: String, onBack: () -> Unit,
    onEdit: () -> Unit, onStatus: () -> Unit, onDelete: () -> Unit, onCopyPlate: () -> Unit,
    onAddMaintenance: () -> Unit, onOpenMaintenance: (Maintenance) -> Unit, onOpenReminder: (DueReminder) -> Unit,
    onAddDocument: () -> Unit, onOpenDocument: (GarageDocument) -> Unit, onShareDocument: (GarageDocument) -> Unit,
    onRenameDocument: (GarageDocument) -> Unit, onDeleteDocument: (GarageDocument) -> Unit, onNotes: (String) -> Unit,
    sharedTransitionScope: SharedTransitionScope? = null, animatedVisibilityScope: AnimatedVisibilityScope? = null,
    onHeroHidden: (Boolean) -> Unit = {},
) {
    val maintenances = state.maintenances.filter { it.vehicleId == v.id }.sortedByDescending { it.date }
    val docs = state.documents.filter { it.vehicleId == v.id }.sortedByDescending { it.addedAt }
    val reminders = remember(state, v.id) { dueReminders(state).filter { it.vehicle.id == v.id } }
    var query by remember(v.id) { mutableStateOf("") }
    var typeFilter by remember(v.id) { mutableStateOf("all") }
    var documentFilter by remember(v.id) { mutableStateOf("all") }
    var allMaintenances by remember(v.id) { mutableStateOf(false) }
    var notes by remember(v.id, v.notes) { mutableStateOf(v.notes) }
    val listState = rememberLazyListState()
    // The dock hides while scrolling down, to leave the content in sight.
    var lastIndex by remember { mutableIntStateOf(0) }
    var lastOffset by remember { mutableIntStateOf(0) }
    var dockVisible by remember { mutableStateOf(true) }
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset }.collect { (i, o) ->
            val down = i > lastIndex || (i == lastIndex && o > lastOffset + 8)
            val up = i < lastIndex || (i == lastIndex && o < lastOffset - 8)
            if (down) dockVisible = false else if (up) dockVisible = true
            lastIndex = i; lastOffset = o
        }
    }

    // Once the photo has scrolled away, a solid bar takes its place at the top.
    val heroLimit = with(LocalDensity.current) { 300.dp.toPx() }
    val heroHidden by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > heroLimit } }
    LaunchedEffect(heroHidden) { onHeroHidden(heroHidden) }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize().imePadding(), state = listState,
            contentPadding = PaddingValues(bottom = 130.dp), verticalArrangement = Arrangement.spacedBy(26.dp)) {
            item(key = "hero") {
                VehicleHero(v, backLabel, onBack, onEdit, onStatus, onCopyPlate, onDelete, sharedTransitionScope, animatedVisibilityScope,
                    parallax = { if (listState.firstVisibleItemIndex == 0) listState.firstVisibleItemScrollOffset.toFloat() else 0f })
            }
            item(key = "cluster") { InstrumentCluster(v, maintenances, Modifier.padding(horizontal = 18.dp).offset(y = (-44).dp).staggerIn(1)) }

            if (reminders.isNotEmpty()) item(key = "deadlines") {
                Column(Modifier.padding(horizontal = 18.dp).offset(y = (-44).dp).staggerIn(2)) {
                    SectionTitle("Scadenze", Modifier.padding(start = 2.dp))
                    Spacer(Modifier.height(6.dp))
                    DeadlineGroup(reminders, showVehicle = false, onClick = onOpenReminder)
                }
            }

            item(key = "history") {
                Column(Modifier.padding(horizontal = 18.dp).offset(y = (-44).dp).animateContentSize(spring(dampingRatio = .9f, stiffness = Spring.StiffnessMediumLow)).staggerIn(3)) {
                    SectionTitle("Interventi", Modifier.padding(start = 2.dp))
                    Spacer(Modifier.height(6.dp))
                    if (maintenances.size > 4) {
                        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            listOf("all", "service", "inspection", "tax", "insurance", "tires", "custom").forEach { value ->
                                MaintenanceFilterPill(value, typeFilter == value) { typeFilter = value; allMaintenances = true }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    if (maintenances.size > 8 && allMaintenances) {
                        SearchField(query, "Cerca interventi") { query = it }
                        Spacer(Modifier.height(10.dp))
                    }
                    val filtered = maintenances.filter { (typeFilter == "all" || it.type == typeFilter) && "${maintenanceLabel(it)} ${it.notes} ${it.date}".contains(query, true) }
                    val shown = if (allMaintenances) filtered else filtered.take(4)
                    when {
                        maintenances.isEmpty() -> EmptyState(R.drawable.ic_wrench, "Ancora nessun intervento", "Tagliandi, revisioni, bollo e assicurazione: registrali con «Intervento» qui sotto.")
                        filtered.isEmpty() -> EmptyState(R.drawable.ic_search, "Nessun intervento trovato", "Prova un altro filtro.")
                        else -> Panel(Modifier.fillMaxWidth(), padding = 0.dp) {
                            shown.forEachIndexed { i, m ->
                                if (i > 0) RowDivider()
                                MaintenanceRow(m) { onOpenMaintenance(m) }
                            }
                            if (filtered.size > 4 || allMaintenances) {
                                RowDivider(0.dp)
                                Text(if (allMaintenances) "Mostra meno" else "Mostra tutti (${filtered.size})", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.fillMaxWidth().bouncyClick { allMaintenances = !allMaintenances; if (!allMaintenances) { query = ""; typeFilter = "all" } }.padding(16.dp))
                            }
                        }
                    }
                    if (maintenances.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text("${maintenances.size} ${if (maintenances.size == 1) "intervento" else "interventi"} · ${euro(maintenances.sumOf { it.cost }, decimals = true)} in tutto",
                            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }

            item(key = "documents") {
                Column(Modifier.padding(horizontal = 18.dp).offset(y = (-44).dp).animateContentSize(spring(dampingRatio = .9f, stiffness = Spring.StiffnessMediumLow)).staggerIn(4)) {
                    SectionTitle("Documenti", Modifier.padding(start = 2.dp))
                    Spacer(Modifier.height(6.dp))
                    if (docs.size > 4) {
                        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            listOf("all", "insurance", "inspection", "tax", "service", "other").forEach { category ->
                                DocumentFilterPill(category, documentFilter == category) { documentFilter = category }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    var docQuery by remember(v.id) { mutableStateOf("") }
                    if (docs.size > 8) { SearchField(docQuery, "Cerca documenti") { docQuery = it }; Spacer(Modifier.height(10.dp)) }
                    val filtered = docs.filter { d -> d.name.contains(docQuery, true) && (documentFilter == "all" || documentCategory(d, state.maintenances) == documentFilter) }
                    when {
                        docs.isEmpty() -> EmptyState(R.drawable.ic_document, "Nessun documento", "Libretto, polizza, ricevute: fotografali o scegli un file con «Documento» qui sotto.")
                        filtered.isEmpty() -> EmptyState(R.drawable.ic_search, "Nessun documento trovato", "Prova un altro filtro.")
                        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            filtered.chunked(2).forEach { pair ->
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    pair.forEach { d ->
                                        DocumentTile(d, documentCategory(d, state.maintenances), Modifier.weight(1f),
                                            onOpen = { onOpenDocument(d) }, onShare = { onShareDocument(d) },
                                            onRename = { onRenameDocument(d) }, onDelete = { onDeleteDocument(d) })
                                    }
                                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                            Text("Tieni premuto un documento per condividerlo, rinominarlo o eliminarlo.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp))
                        }
                    }
                }
            }

            item(key = "notes") {
                Column(Modifier.padding(horizontal = 18.dp).offset(y = (-44).dp).staggerIn(5)) {
                    SectionTitle("Note", Modifier.padding(start = 2.dp))
                    Spacer(Modifier.height(6.dp))
                    GarageNotesCard(v.notesUpdatedAt, notes, { notes = it }, changed = notes != v.notes) { onNotes(notes) }
                }
            }
        }

        AnimatedVisibility(heroHidden, modifier = Modifier.align(Alignment.TopCenter), enter = fadeIn(tween(180)) + slideInVertically { -it / 3 }, exit = fadeOut(tween(160))) {
            Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background)) {
                Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    RoundIconButton(R.drawable.ic_arrow_back, "Torna a $backLabel", onBack)
                    Spacer(Modifier.width(12.dp))
                    Text(v.name, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    if (v.plate.isNotBlank()) VehiclePlate(v.plate, v.vehicleType, v.year, compact = true)
                }
                HorizontalDivider(color = hairline())
            }
        }

        // The two things added most often, always at hand at the bottom.
        AnimatedVisibility(
            visible = dockVisible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(spring(dampingRatio = .8f, stiffness = Spring.StiffnessMediumLow)) { it } + fadeIn(),
            exit = slideOutVertically(tween(200)) { it } + fadeOut(tween(160)),
        ) {
            Box(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.background.copy(alpha = .92f), MaterialTheme.colorScheme.background)))
                .navigationBarsPadding().padding(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 14.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AccentButton(onClick = onAddMaintenance, modifier = Modifier.weight(1f)) {
                        Icon(painterResource(R.drawable.ic_add), contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp)); Text("Intervento")
                    }
                    GhostButton(onClick = onAddDocument, modifier = Modifier.weight(1f)) {
                        Icon(painterResource(R.drawable.ic_document), contentDescription = null, modifier = Modifier.size(19.dp))
                        Spacer(Modifier.width(8.dp)); Text("Documento")
                    }
                }
            }
        }
    }
}

/** The photo edge to edge under the status bar, with back, menu, name, model and plate. */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable private fun VehicleHero(
    v: Vehicle, backLabel: String, onBack: () -> Unit, onEdit: () -> Unit, onStatus: () -> Unit,
    onCopyPlate: () -> Unit, onDelete: () -> Unit,
    sharedTransitionScope: SharedTransitionScope?, animatedVisibilityScope: AnimatedVisibilityScope?, parallax: () -> Float,
) {
    val statusLabel = when (v.status) { "sold" -> "Venduta"; "scrapped" -> "Rottamata"; else -> "" }
    // Clipped: with the parallax the photo slides down, and its edge must not show below the fade.
    Box(Modifier.fillMaxWidth().height(400.dp).clipToBounds()) {
        val photoModifier = if (sharedTransitionScope != null && animatedVisibilityScope != null) with(sharedTransitionScope) {
            Modifier.sharedElement(rememberSharedContentState("vehicle-photo-${v.id}"), animatedVisibilityScope,
                boundsTransform = { _, _ -> tween(420, easing = FastOutSlowInEasing) })
        } else Modifier
        Box(Modifier.matchParentSize().then(photoModifier).graphicsLayer { translationY = parallax() * .4f }) {
            VehiclePhoto(v, Modifier.fillMaxSize())
        }
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(
            0f to Color.Black.copy(alpha = .5f), .22f to Color.Transparent, .5f to Color.Transparent,
            .85f to MaterialTheme.colorScheme.background.copy(alpha = .85f), 1f to MaterialTheme.colorScheme.background)))
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            RoundIconButton(R.drawable.ic_arrow_back, "Torna a $backLabel", onBack, overPhoto = true)
            Spacer(Modifier.weight(1f))
            Box {
                var menu by remember { mutableStateOf(false) }
                RoundIconButton(R.drawable.ic_more, "Altre azioni", { menu = true }, overPhoto = true)
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, shape = RoundedCornerShape(16.dp)) {
                    MenuEntry("Modifica auto", R.drawable.ic_edit) { menu = false; onEdit() }
                    MenuEntry("Cambia stato", R.drawable.ic_car) { menu = false; onStatus() }
                    if (v.plate.isNotBlank()) MenuEntry("Copia targa", R.drawable.ic_copy) { menu = false; onCopyPlate() }
                    HorizontalDivider()
                    MenuEntry("Elimina auto", R.drawable.ic_delete, destructive = true) { menu = false; onDelete() }
                }
            }
        }
        Column(Modifier.align(Alignment.BottomStart).padding(start = 20.dp, end = 20.dp, bottom = 62.dp).staggerIn(0)) {
            if (statusLabel.isNotBlank()) {
                StatusPill(statusLabel + (v.statusDate.takeIf { it.isNotBlank() }?.let { " il ${dateLabel(it)}" } ?: ""), Steel, onPhoto = true)
                Spacer(Modifier.height(10.dp))
            }
            Text(v.name, color = MaterialTheme.colorScheme.onBackground, fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.9).sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val model = listOf("${v.make} ${v.model}".trim(), vehicleTypeLabel(v.vehicleType)).filter { it.isNotBlank() }.joinToString(" · ")
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(model, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (v.plate.isNotBlank()) {
                    Spacer(Modifier.width(10.dp))
                    VehiclePlate(v.plate, v.vehicleType, v.registrationDate.take(4).toIntOrNull() ?: v.year, compact = true)
                }
            }
        }
    }
}

/** Kilometres, money spent and interventions as dashboard readings; the car's specs underneath. */
@Composable private fun InstrumentCluster(v: Vehicle, maintenances: List<Maintenance>, modifier: Modifier = Modifier) {
    Panel(modifier.fillMaxWidth(), padding = 16.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Readout("Chilometri", Modifier.weight(1.2f)) { AnimatedCount(v.mileage, it) }
            ReadoutDivider()
            Readout("Spesi in tutto", Modifier.weight(1.1f)) { AnimatedCount(maintenances.sumOf { it.cost }, it, format = { x -> euro(x) }) }
            ReadoutDivider()
            Readout("Interventi", Modifier.weight(.8f)) { AnimatedCount(maintenances.size, it) }
        }
        val specs = buildList {
            if (v.fuel.isNotBlank()) add(R.drawable.ic_fuel to v.fuel)
            if (v.year > 0) add(R.drawable.ic_calendar_nav to v.year.toString())
            if (v.registrationDate.isNotBlank()) add(R.drawable.ic_license_plate to "Immatricolata ${runCatching { LocalDate.parse(v.registrationDate).format(DateTimeFormatter.ofPattern("MM/yyyy", Locale.ITALY)) }.getOrDefault(v.registrationDate)}")
        }
        if (specs.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            HorizontalDivider(color = hairline())
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                specs.forEach { (icon, label) ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, maxLines = 1)
                    }
                }
            }
        }
    }
}

/** One intervention of the history: date column, type and notes, cost. */
@Composable private fun MaintenanceRow(m: Maintenance, onClick: () -> Unit) {
    val appearance = maintenanceAppearance(m.type)
    val date = runCatching { LocalDate.parse(m.date) }.getOrNull()
    Row(Modifier.fillMaxWidth().bouncyClick(onClickLabel = "Apri dettaglio intervento", onClick = onClick).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically) {
        TintBadge(appearance.icon, appearance.tint, appearance.background, 46.dp, 22.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(maintenanceLabel(m), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val line = listOfNotNull(date?.format(DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ITALY)) ?: m.date, m.mileage.formatKm(), m.notes.lineSequence().firstOrNull()?.takeIf { it.isNotBlank() })
            Text(line.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Text(euro(m.cost, decimals = m.cost % 1.0 != 0.0), fontSize = 15.sp, fontWeight = FontWeight.Bold, style = Numeric, maxLines = 1)
    }
}

/** A document as a tile with its preview; long press for the quick actions. */
@OptIn(ExperimentalFoundationApi::class)
@Composable private fun DocumentTile(
    document: GarageDocument, category: String, modifier: Modifier,
    onOpen: () -> Unit, onShare: () -> Unit, onRename: () -> Unit, onDelete: () -> Unit
) {
    var menu by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(18.dp)
    Box(modifier) {
        Column(Modifier.fillMaxWidth().clip(shape).background(MaterialTheme.colorScheme.surface).border(1.dp, hairline(), shape)
            .combinedClickable(onClickLabel = "Apri ${document.name}", onLongClickLabel = "Azioni rapide", onLongClick = { menu = true }, onClick = onOpen)) {
            DocumentThumbnail(document, category, Modifier.fillMaxWidth().height(112.dp), corner = 0.dp)
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                Text(document.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${documentFormat(document)} · ${documentDate(document.addedAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }, shape = RoundedCornerShape(16.dp)) {
            MenuEntry("Condividi", R.drawable.ic_share) { menu = false; onShare() }
            MenuEntry("Rinomina", R.drawable.ic_edit) { menu = false; onRename() }
            HorizontalDivider()
            MenuEntry("Elimina", R.drawable.ic_delete, destructive = true) { menu = false; onDelete() }
        }
    }
}

@Composable internal fun MenuEntry(label: String, icon: Int, destructive: Boolean = false, onClick: () -> Unit) {
    val color = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    DropdownMenuItem(text = { Text(label, color = color, fontWeight = FontWeight.Medium) }, onClick = onClick,
        leadingIcon = { Icon(painterResource(icon), contentDescription = null, tint = color, modifier = Modifier.size(20.dp)) })
}

@Composable private fun SearchField(value: String, placeholder: String, onChange: (String) -> Unit) {
    OutlinedTextField(value, onChange, placeholder = { Text(placeholder) },
        leadingIcon = { Icon(painterResource(R.drawable.ic_search), contentDescription = null, modifier = Modifier.size(20.dp)) },
        modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(16.dp))
}
