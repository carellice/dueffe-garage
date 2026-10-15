package it.dueffe.garage

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.Manifest
import android.os.Build
import android.os.SystemClock
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.BoundsTransform
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

internal val Gold = Color(0xFFFFD84D)
internal val Black = Color(0xFF0A0907)
private val Panel = Color(0xFF171510)
private val Cream = Color(0xFFFFF8E9)
private val Muted = Color(0xFFB7A98E)

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repo = GarageRepository(this)
        setContent { GarageApp(repo) }
    }
    fun authenticate(onSuccess: () -> Unit, onError: (String) -> Unit) {
        val authenticators = if (Build.VERSION.SDK_INT >= 30) BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL else BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (BiometricManager.from(this).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) { onError("Configura prima un blocco schermo sul dispositivo"); return }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { onSuccess() }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { if (errorCode != BiometricPrompt.ERROR_USER_CANCELED && errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) onError(errString.toString()) }
        })
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("Sblocca Garage").setSubtitle("Usa il blocco del dispositivo").setAllowedAuthenticators(authenticators).build())
    }
    fun canUseBiometrics(): Boolean = BiometricManager.from(this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
    fun authenticateBiometric(onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (!canUseBiometrics()) { onError("Biometria non disponibile su questo dispositivo"); return }
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { onSuccess() }
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                if (errorCode != BiometricPrompt.ERROR_USER_CANCELED && errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) onError(errString.toString())
            }
        })
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("Sblocca Garage")
            .setSubtitle("Usa la biometria oppure il PIN di Garage")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setNegativeButtonText("Usa PIN").build())
    }
}

private data class GarageDestination(val screen: String, val vehicleId: String? = null, val itemId: String? = null)

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable private fun GarageApp(repo: GarageRepository) {
    val context = LocalContext.current
    var state by remember { mutableStateOf(repo.snapshot()) }
    var page by remember { mutableStateOf(if ((context as MainActivity).intent?.getStringExtra("open_page") == "scadenze") "scadenze" else "garage") }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var sectionsOpen by remember { mutableStateOf(false) }
    var tab by remember { mutableStateOf("Interventi") }
    var editVehicle by remember { mutableStateOf<Vehicle?>(null) }
    var newVehicle by remember { mutableStateOf(false) }
    var editMaintenance by remember { mutableStateOf<Maintenance?>(null) }
    var newMaintenance by remember { mutableStateOf(false) }
    var addDocument by remember { mutableStateOf(false) }
    var editDocument by remember { mutableStateOf<GarageDocument?>(null) }
    var openMaintenanceId by remember { mutableStateOf<String?>(null) }
    var openReminderId by remember { mutableStateOf<String?>(null) }
    var openDocumentId by remember { mutableStateOf<String?>(null) }
    var statusEdit by remember { mutableStateOf(false) }
    var deleteVehicle by remember { mutableStateOf<Vehicle?>(null) }
    var deleteMaintenance by remember { mutableStateOf<Maintenance?>(null) }
    var deleteReminder by remember { mutableStateOf<Reminder?>(null) }
    var deleteDocument by remember { mutableStateOf<GarageDocument?>(null) }
    var renameDocument by remember { mutableStateOf<GarageDocument?>(null) }
    var documentToOpen by remember { mutableStateOf<GarageDocument?>(null) }
    var importedBytes by remember { mutableStateOf<ByteArray?>(null) }
    var importSummary by remember { mutableStateOf("") }
    var theme by remember { mutableStateOf(repo.theme) }
    var protection by remember { mutableStateOf(repo.protectionEnabled) }
    var locked by remember { mutableStateOf(repo.protectionEnabled) }
    var biometric by remember { mutableStateOf(repo.biometricEnabled) }
    var hasPin by remember { mutableStateOf(repo.hasPin) }
    var pinSetup by remember { mutableStateOf(false) }
    var pinSetupEnablesProtection by remember { mutableStateOf(false) }
    var notifications by remember { mutableStateOf(repo.notificationsEnabled) }
    var leadDays by remember { mutableIntStateOf(repo.notificationLeadDays) }
    var onboarding by remember { mutableStateOf(!repo.onboardingDone) }
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    var documentUri by remember { mutableStateOf<Uri?>(null) }
    var cameraUri by remember { mutableStateOf<Uri?>(null) }
    var documentName by remember { mutableStateOf("") }
    var documentError by remember { mutableStateOf("") }
    var documentMaintenanceId by remember { mutableStateOf<String?>(null) }
    var lastTap by remember { mutableStateOf(Offset.Unspecified) }
    var lastTapAt by remember { mutableLongStateOf(0L) }
    var scaffoldOrigin by remember { mutableStateOf(Offset.Zero) }
    var contentBounds by remember { mutableStateOf(Rect.Zero) }
    val openingOrigins = remember { mutableMapOf<GarageDestination, TransformOrigin>() }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, protection) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP && protection) locked = true }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    fun refresh() { state = repo.snapshot() }
    fun message(value: String) { Toast.makeText(context, value, Toast.LENGTH_SHORT).show() }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { photoUri = it }
    val documentPhotoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        documentUri = uri; documentName = uri?.let { pickedName(context, it).substringBeforeLast('.') } ?: ""
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) { documentUri = cameraUri; documentName = "Foto_${LocalDate.now()}" }
        else documentError = "Foto non acquisita"
    }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        notifications = granted; repo.notificationsEnabled = granted; scheduleReminders(context, granted)
        message(if (granted) "Notifiche abilitate" else "Permesso notifiche non concesso")
    }
    LaunchedEffect(Unit) { scheduleReminders(context, repo.notificationsEnabled) }
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        documentUri = uri
        documentName = uri?.let { pickedName(context, it).substringBeforeLast('.') } ?: ""
        documentError = ""
    }
    val exportPicker = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openOutputStream(uri)?.use { it.write(repo.exportBackup()) } ?: error("File non scrivibile")
            repo.lastExportAt = now(); message("Backup esportato")
        }.onFailure { message("Esportazione non riuscita: ${it.message}") }
    }
    val importPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) runCatching {
            val bytes = repo.readUri(uri, 250 * 1024 * 1024)
            val json = org.json.JSONObject(bytes.toString(Charsets.UTF_8)).getJSONObject("data")
            importSummary = "${json.getJSONArray("vehicles").length()} auto · ${json.getJSONArray("maintenances").length()} interventi · ${json.getJSONArray("documents").length()} documenti"
            importedBytes = bytes
        }.onFailure { message("Backup non leggibile: ${it.message}") }
    }
    val selected = state.vehicles.firstOrNull { it.id == selectedId }
    BackHandler(newVehicle || editVehicle != null || newMaintenance || editMaintenance != null || addDocument || editDocument != null || openMaintenanceId != null || openReminderId != null || openDocumentId != null || sectionsOpen || selectedId != null || page != "garage") {
        lastTap = Offset.Unspecified
        when {
            newMaintenance || editMaintenance != null -> { newMaintenance = false; editMaintenance = null }
            addDocument || editDocument != null -> { addDocument = false; editDocument = null; documentUri = null; documentName = ""; documentError = ""; documentMaintenanceId = null }
            newVehicle || editVehicle != null -> { newVehicle = false; editVehicle = null; photoUri = null }
            openMaintenanceId != null -> openMaintenanceId = null
            openReminderId != null -> openReminderId = null
            openDocumentId != null -> openDocumentId = null
            sectionsOpen -> sectionsOpen = false
            selectedId != null -> selectedId = null
            else -> page = "garage"
        }
    }
    val isDark = when (theme) { "light" -> false; "dark" -> true; else -> androidx.compose.foundation.isSystemInDarkTheme() }
    LaunchedEffect(isDark, onboarding) {
        val window = (context as MainActivity).window
        window.decorView.post {
            WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = !isDark && !onboarding
        }
    }
    val colors = if (isDark) darkColorScheme(
        primary = Gold, onPrimary = Black, background = Black, surface = Panel,
        surfaceContainerLowest = Black, surfaceContainerLow = Panel, surfaceContainer = Panel,
        surfaceContainerHigh = Color(0xFF221F19), surfaceContainerHighest = Color(0xFF2C281F),
        surfaceVariant = Color(0xFF29251D), onSurfaceVariant = Muted, outline = Color(0xFF6E6042),
        onBackground = Cream, onSurface = Cream, secondary = Muted,
        secondaryContainer = Color(0xFF403515), onSecondaryContainer = Cream
    ) else lightColorScheme(
        primary = Color(0xFF795600), onPrimary = Color.White, background = Color(0xFFF6F4EE), surface = Color.White,
        surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFFFFCF5),
        surfaceContainer = Color(0xFFF8F5ED), surfaceContainerHigh = Color(0xFFF0EBDF),
        surfaceContainerHighest = Color(0xFFE9E2D3), surfaceVariant = Color(0xFFE9E2D3),
        onSurfaceVariant = Color(0xFF665B46), outline = Color(0xFF85745A),
        onBackground = Black, onSurface = Black, secondary = Color(0xFF665B46),
        secondaryContainer = Color(0xFFFFE9A8), onSecondaryContainer = Black
    )
    MaterialTheme(colorScheme = colors, shapes = Shapes(medium = RoundedCornerShape(20.dp), large = RoundedCornerShape(26.dp))) {
        if (locked) {
            GarageLockScreen(hasPin = hasPin, pinLength = repo.pinLength, biometric = biometric && (context as MainActivity).canUseBiometrics(), isDark = isDark,
                verifyPin = repo::verifyPin, onUnlocked = { locked = false },
                onBiometric = { (context as MainActivity).authenticateBiometric({ locked = false }, ::message) },
                onLegacyUnlock = { (context as MainActivity).authenticate({ locked = false }, ::message) })
        } else if (onboarding) {
            Onboarding { repo.onboardingDone = true; onboarding = false }
        } else {
            val showNavigation = !newVehicle && editVehicle == null && !newMaintenance && editMaintenance == null && !addDocument && editDocument == null && openMaintenanceId == null && openReminderId == null && openDocumentId == null
            Scaffold(
                modifier = Modifier.fillMaxSize()
                    .onGloballyPositioned { scaffoldOrigin = it.positionInRoot() }
                    .pointerInput(Unit) {
                        awaitEachGesture {
                            val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                            lastTap = down.position + scaffoldOrigin
                            lastTapAt = SystemClock.uptimeMillis()
                        }
                    },
            ) { padding ->
                val destination = when {
                    newVehicle || editVehicle != null -> GarageDestination("vehicle-editor", selectedId)
                    newMaintenance || editMaintenance != null -> GarageDestination("maintenance-editor", selectedId)
                    addDocument || editDocument != null -> GarageDestination("document-editor", selectedId, editDocument?.id)
                    openMaintenanceId != null -> GarageDestination("maintenance-detail", selectedId, openMaintenanceId)
                    openReminderId != null -> GarageDestination("reminder-detail", selectedId, openReminderId)
                    openDocumentId != null -> GarageDestination("document-detail", selectedId, openDocumentId)
                    sectionsOpen && selectedId != null -> GarageDestination("sections", selectedId)
                    selectedId != null -> GarageDestination("detail", selectedId)
                    page == "scadenze" -> GarageDestination("scadenze")
                    page == "impostazioni" -> GarageDestination("impostazioni")
                    else -> GarageDestination("garage")
                }
                Box(Modifier.fillMaxSize()) {
                SharedTransitionLayout(Modifier.fillMaxSize().padding(padding)
                    .onGloballyPositioned { contentBounds = it.boundsInRoot() }) {
                    AnimatedContent(
                        targetState = destination,
                        modifier = Modifier.fillMaxSize(),
                        transitionSpec = {
                            val hero = setOf(initialState.screen, targetState.screen) == setOf("garage", "detail")
                            val buttonHero = setOf(initialState.screen, targetState.screen) == setOf("garage", "vehicle-editor")
                            val depth = mapOf("garage" to 0, "scadenze" to 0, "impostazioni" to 0, "detail" to 1, "sections" to 2,
                                "maintenance-detail" to 3, "reminder-detail" to 3, "document-detail" to 3,
                                "vehicle-editor" to 4, "maintenance-editor" to 4, "document-editor" to 4)
                            val goingBack = (depth[targetState.screen] ?: 0) < (depth[initialState.screen] ?: 0)
                            val recentTap = lastTap != Offset.Unspecified && SystemClock.uptimeMillis() - lastTapAt < 1200L
                            val tapOrigin = if (recentTap && contentBounds.width > 0f && contentBounds.height > 0f) TransformOrigin(
                                ((lastTap.x - contentBounds.left) / contentBounds.width).coerceIn(0f, 1f),
                                ((lastTap.y - contentBounds.top) / contentBounds.height).coerceIn(0f, 1f)
                            ) else TransformOrigin.Center
                            if (!goingBack && !hero) openingOrigins[targetState] = tapOrigin
                            val origin = if (goingBack) openingOrigins[initialState] ?: TransformOrigin.Center else tapOrigin
                            val enter = if (buttonHero) fadeIn(tween(if (goingBack) 120 else 260)) else if (hero || goingBack) fadeIn(tween(180)) else scaleIn(
                                initialScale = if (recentTap && !goingBack) 0.12f else 0.94f,
                                transformOrigin = origin,
                                animationSpec = tween(340, easing = FastOutSlowInEasing)
                            ) + fadeIn(tween(110))
                            val exit = if (buttonHero) fadeOut(tween(if (goingBack) 300 else 140)) else if (hero) fadeOut(tween(140)) else if (!goingBack) fadeOut(tween(150)) else scaleOut(
                                targetScale = if (goingBack && openingOrigins.containsKey(initialState)) 0.12f else 0.96f,
                                transformOrigin = origin,
                                animationSpec = tween(if (goingBack) 300 else 230, easing = FastOutSlowInEasing)
                            ) + fadeOut(tween(if (goingBack) 110 else 140, delayMillis = if (goingBack) 190 else 130))
                            (enter togetherWith exit).using(SizeTransform(clip = false))
                        },
                        label = "garage_navigation"
                    ) { shown ->
                        val selected = state.vehicles.firstOrNull { it.id == shown.vehicleId }
                        val pageModifier = if (shown.screen == "vehicle-editor" && editVehicle == null) with(this@SharedTransitionLayout) {
                            Modifier.sharedBounds(rememberSharedContentState("add-vehicle-page"), this@AnimatedContent,
                                enter = fadeIn(tween(260)), exit = fadeOut(tween(300)),
                                boundsTransform = BoundsTransform { _, _ -> tween(340, easing = FastOutSlowInEasing) })
                        } else Modifier
                        Box(Modifier.fillMaxSize().then(pageModifier).background(MaterialTheme.colorScheme.background)) {
                        when (shown.screen) {
                        "vehicle-editor" -> VehicleEditor(editVehicle, photoUri, { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                            onDismiss = { newVehicle = false; editVehicle = null; photoUri = null }, onSave = { value ->
                                repo.save(value); refresh(); newVehicle = false; editVehicle = null; photoUri = null; selectedId = value.id; message("Auto salvata")
                            }, repo = repo)
                        "maintenance-editor" -> selected?.let { MaintenanceEditor(selected, editMaintenance,
                            state.reminders.firstOrNull { it.maintenanceId == editMaintenance?.id },
                            onDismiss = { newMaintenance = false; editMaintenance = null }, onSave = { m, r -> repo.save(m, r); refresh(); newMaintenance = false; editMaintenance = null; message("Intervento salvato") }) }
                        "document-editor" -> selected?.let { DocumentEditor(documentUri, documentName, documentError,
                            existing = editDocument,
                            maintenances = state.maintenances.filter { it.vehicleId == selected.id },
                            linkedMaintenanceId = documentMaintenanceId,
                            onLinkMaintenanceChange = { documentMaintenanceId = it },
                            onNameChange = { documentName = it; documentError = "" },
                            onCamera = { val file = File(context.cacheDir, "shared-documents/camera-${System.currentTimeMillis()}.jpg").apply { parentFile?.mkdirs() }; cameraUri = FileProvider.getUriForFile(context, "${context.packageName}.files", file); cameraLauncher.launch(cameraUri!!) },
                            onGallery = { documentPhotoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                            onFile = { filePicker.launch(arrayOf("*/*")) },
                            onDismiss = { addDocument = false; editDocument = null; documentUri = null; documentName = ""; documentError = ""; documentMaintenanceId = null },
                            onSave = {
                                val uri = documentUri
                                if ((uri == null && editDocument == null) || documentName.isBlank()) documentError = "Scegli un file e inserisci il nome"
                                else runCatching {
                                    val bytes = if (uri != null) repo.readUri(uri) else editDocument!!.data
                                    require(bytes.isNotEmpty()) { "File vuoto" }
                                    val mime = if (uri != null) context.contentResolver.getType(uri) ?: "application/octet-stream" else editDocument!!.mimeType
                                    require(documentMaintenanceId == null || state.maintenances.any { it.id == documentMaintenanceId && it.vehicleId == selected.id }) { "Intervento non disponibile" }
                                    val previous = editDocument
                                    repo.save(GarageDocument(id = previous?.id ?: java.util.UUID.randomUUID().toString(), vehicleId = selected.id,
                                        name = documentName.trim(), mimeType = mime, category = if (mime.startsWith("image/")) "image" else if (mime == "application/pdf") "pdf" else "document",
                                        size = bytes.size, data = bytes, addedAt = previous?.addedAt ?: now(), updatedAt = now(), maintenanceId = documentMaintenanceId))
                                    refresh(); addDocument = false; editDocument = null; documentUri = null; documentName = ""; documentError = ""; documentMaintenanceId = null; message("Documento salvato")
                                }.onFailure { documentError = it.message ?: "File non leggibile" }
                            }) }
                        "maintenance-detail" -> state.maintenances.firstOrNull { it.id == shown.itemId }?.let { maintenance ->
                            MaintenanceDetailScreen(maintenance, state.reminders.firstOrNull { it.maintenanceId == maintenance.id },
                                onBack = { openMaintenanceId = null }, onEdit = { editMaintenance = maintenance },
                                onDelete = { deleteMaintenance = maintenance })
                        }
                        "reminder-detail" -> dueReminders(state).firstOrNull { it.reminder.id == shown.itemId }?.let { due ->
                            ReminderDetailScreen(due, onBack = { openReminderId = null },
                                onEdit = { editMaintenance = due.maintenance }, onDelete = { deleteReminder = due.reminder })
                        }
                        "document-detail" -> state.documents.firstOrNull { it.id == shown.itemId }?.let { document ->
                            DocumentDetailScreen(document, state.maintenances.firstOrNull { it.id == document.maintenanceId },
                                onBack = { openDocumentId = null }, onOpenFile = { documentToOpen = document },
                                onShare = { shareDocument(context, document) },
                                onEdit = { editDocument = document; documentName = document.name; documentMaintenanceId = document.maintenanceId; documentUri = null; documentError = "" },
                                onDelete = { deleteDocument = document })
                        }
                        "sections" -> selected?.let { VehicleDetail(selected, state, tab, { tab = it }, sectionsPage = true, onClose = { sectionsOpen = false }, onOpenSections = {},
                            onEdit = { editVehicle = selected }, onStatus = { statusEdit = true }, onDelete = { deleteVehicle = selected },
                            onAddMaintenance = { newMaintenance = true }, onEditMaintenance = { editMaintenance = it }, onDeleteMaintenance = { deleteMaintenance = it },
                            onOpenMaintenance = { openMaintenanceId = it.id }, onOpenReminder = { openReminderId = it.reminder.id },
                            onAddDocument = { documentMaintenanceId = null; addDocument = true }, onOpenDocument = { openDocumentId = it.id }, onShareDocument = { shareDocument(context, it) }, onRenameDocument = { renameDocument = it }, onDeleteDocument = { deleteDocument = it },
                            onNotes = { notes -> repo.save(selected.copy(notes = notes, notesUpdatedAt = now(), updatedAt = now())); refresh() },
                            onCopyPlate = { copyPlate(context, selected.plate); message("Targa copiata") }) }
                        "garage" -> GarageHome(state, { newVehicle = true }, { selectedId = it; sectionsOpen = false; tab = "Interventi" }, this@SharedTransitionLayout, this@AnimatedContent)
                        "detail" -> selected?.let { vehicle ->
                                    VehicleDetail(vehicle, state, tab, { tab = it }, sectionsPage = false, onClose = { selectedId = null }, onOpenSections = { tab = "Interventi"; sectionsOpen = true },
                                        onEdit = { editVehicle = vehicle }, onStatus = { statusEdit = true }, onDelete = { deleteVehicle = vehicle },
                                        onAddMaintenance = { newMaintenance = true }, onEditMaintenance = { editMaintenance = it }, onDeleteMaintenance = { deleteMaintenance = it },
                                        onOpenMaintenance = { openMaintenanceId = it.id }, onOpenReminder = { openReminderId = it.reminder.id },
                                        onAddDocument = { documentMaintenanceId = null; addDocument = true }, onOpenDocument = { documentToOpen = it }, onShareDocument = { shareDocument(context, it) }, onRenameDocument = { renameDocument = it }, onDeleteDocument = { deleteDocument = it },
                                        onNotes = { notes -> repo.save(vehicle.copy(notes = notes, notesUpdatedAt = now(), updatedAt = now())); refresh() },
                                        onCopyPlate = { copyPlate(context, vehicle.plate); message("Targa copiata") }, backLabel = if (page == "scadenze") "Scadenze" else "Garage",
                                        sharedTransitionScope = this@SharedTransitionLayout, animatedVisibilityScope = this@AnimatedContent)
                        }
                        "scadenze" -> ReminderScreen(state) { selectedId = it; sectionsOpen = false }
                        else -> SettingsScreen(theme, { theme = it; repo.theme = it }, repo.lastChangeAt, repo.lastExportAt,
                            notifications = notifications, onNotifications = { enabled ->
                                if (enabled && Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                                else { notifications = enabled; repo.notificationsEnabled = enabled; scheduleReminders(context, enabled) }
                            }, leadDays = leadDays, onLeadDays = { leadDays = it; repo.notificationLeadDays = it },
                            protection = protection, onProtection = { enabled ->
                                if (enabled) {
                                    if (hasPin) { protection = true; repo.protectionEnabled = true; message("Protezione attivata") }
                                    else { pinSetupEnablesProtection = true; pinSetup = true }
                                } else { protection = false; repo.protectionEnabled = false; message("Protezione disattivata") }
                            }, hasPin = hasPin, onChangePin = { pinSetupEnablesProtection = false; pinSetup = true },
                            biometric = biometric, biometricAvailable = (context as MainActivity).canUseBiometrics(),
                            onBiometric = { enabled ->
                                if (enabled) (context as MainActivity).authenticateBiometric({ biometric = true; repo.biometricEnabled = true }, ::message)
                                else { biometric = false; repo.biometricEnabled = false }
                            }, onLock = { locked = true },
                            onExport = { exportPicker.launch("garage_${LocalDate.now()}.json") }, onImport = { importPicker.launch(arrayOf("application/json")) },
                            onOnboarding = { onboarding = true }, onClear = { repo.clear(); refresh(); selectedId = null; message("Dati eliminati") })
                        }
                        }
                    }
                }
                if (showNavigation) FloatingGarageNavigation(page, Modifier.align(Alignment.BottomCenter)) { key -> selectedId = null; sectionsOpen = false; page = key }
                }
            }
        }
        if (selected != null && statusEdit) StatusEditor(selected, { statusEdit = false }, { v -> repo.save(v); refresh(); statusEdit = false; message("Stato aggiornato") })
        deleteVehicle?.let { item -> ConfirmDelete("Eliminare ${item.name} e tutti i suoi dati?", { deleteVehicle = null }, { repo.deleteVehicle(item.id); refresh(); selectedId = null; sectionsOpen = false; deleteVehicle = null }) }
        deleteMaintenance?.let { item -> ConfirmDelete("Eliminare questo intervento e il suo promemoria?", { deleteMaintenance = null }, { repo.deleteMaintenance(item.id); refresh(); if (openMaintenanceId == item.id) openMaintenanceId = null; if (openReminderId != null) openReminderId = null; deleteMaintenance = null }) }
        deleteReminder?.let { item -> ConfirmDelete("Eliminare questa scadenza? L'intervento resterà nel diario.", { deleteReminder = null }, { repo.deleteReminder(item.id); refresh(); if (openReminderId == item.id) openReminderId = null; deleteReminder = null }) }
        deleteDocument?.let { item -> ConfirmDelete("Eliminare ${item.name}?", { deleteDocument = null }, { repo.deleteDocument(item.id); refresh(); if (openDocumentId == item.id) openDocumentId = null; deleteDocument = null }) }
        renameDocument?.let { item -> var name by remember(item.id) { mutableStateOf(item.name) }; AlertDialog(onDismissRequest = { renameDocument = null }, title = { Text("Rinomina documento") }, text = { OutlinedTextField(name, { name = it }, label = { Text("Nome") }) }, confirmButton = { TextButton(onClick = { if (name.isNotBlank()) { repo.save(item.copy(name = name.trim(), updatedAt = now())); refresh(); renameDocument = null } }) { Text("Salva") } }, dismissButton = { TextButton(onClick = { renameDocument = null }) { Text("Annulla") } }) }
        importedBytes?.let { bytes -> AlertDialog(onDismissRequest = { importedBytes = null }, title = { Text("Importa backup") }, text = { Text("$importSummary\n\nL'importazione sostituirà tutti i dati attuali. Il file non è cifrato.") }, confirmButton = { TextButton(onClick = { runCatching { repo.importBackup(bytes); refresh(); importedBytes = null; selectedId = null; message("Backup importato") }.onFailure { message("Importazione annullata: ${it.message}"); importedBytes = null } }) { Text("Importa") } }, dismissButton = { TextButton(onClick = { importedBytes = null }) { Text("Annulla") } }) }
        documentToOpen?.let { doc -> LaunchedEffect(doc) { openDocument(context, doc); documentToOpen = null } }
        if (pinSetup) PinSetupDialog(existingPin = hasPin, verifyPin = repo::verifyPin, onDismiss = { pinSetup = false; pinSetupEnablesProtection = false }, onSave = { pin ->
            repo.setPin(pin); hasPin = true; pinSetup = false
            if (pinSetupEnablesProtection) { protection = true; repo.protectionEnabled = true; message("Protezione attivata") }
            else message("PIN aggiornato")
            pinSetupEnablesProtection = false
        })
    }
}

@Composable private fun FloatingGarageNavigation(page: String, modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
    val destinations = listOf(Triple("garage", "Garage", R.drawable.ic_garage_nav), Triple("scadenze", "Scadenze", R.drawable.ic_calendar_nav), Triple("impostazioni", "Impostazioni", R.drawable.ic_settings_nav))
    Box(modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 8.dp)) {
        BoxWithConstraints(Modifier.fillMaxWidth().shadow(12.dp, RoundedCornerShape(30.dp)).background(MaterialTheme.colorScheme.surface, RoundedCornerShape(30.dp)).padding(5.dp)) {
            val segment = maxWidth / destinations.size
            val selectedIndex = destinations.indexOfFirst { it.first == page }.coerceAtLeast(0)
            val indicatorX by animateDpAsState(segment * selectedIndex, tween(340, easing = FastOutSlowInEasing), label = "bottom_navigation_pill")
            Box(Modifier.offset(x = indicatorX).width(segment).height(58.dp).background(MaterialTheme.colorScheme.secondaryContainer, RoundedCornerShape(25.dp)))
            Row(Modifier.fillMaxWidth().selectableGroup()) {
                destinations.forEach { (key, label, icon) ->
                    val selected = key == page
                    val interaction = remember { MutableInteractionSource() }
                    Column(Modifier.weight(1f).height(58.dp).clip(RoundedCornerShape(25.dp)).selectable(selected = selected, interactionSource = interaction, indication = null, role = Role.Tab, onClick = { onSelect(key) }),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(painterResource(icon), contentDescription = null, tint = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(23.dp))
                        Spacer(Modifier.height(2.dp))
                        Text(label, color = if (selected) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable private fun GarageLockScreen(hasPin: Boolean, pinLength: Int, biometric: Boolean, isDark: Boolean,
    verifyPin: (String) -> Boolean, onUnlocked: () -> Unit, onBiometric: () -> Unit, onLegacyUnlock: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var failures by remember { mutableIntStateOf(0) }
    var blockedUntil by remember { mutableLongStateOf(0L) }
    LaunchedEffect(biometric, hasPin) { if (biometric && hasPin) onBiometric() }
    fun digit(value: Int) {
        if (SystemClock.elapsedRealtime() < blockedUntil) { error = "Riprova tra qualche secondo"; return }
        if (pin.length >= 8) return
        val candidate = pin + value
        pin = candidate; error = ""
        val shouldCheck = if (pinLength in 4..8) candidate.length == pinLength else candidate.length >= 4
        if (shouldCheck && verifyPin(candidate)) { pin = ""; failures = 0; onUnlocked(); return }
        if ((pinLength in 4..8 && candidate.length == pinLength) || candidate.length == 8) {
            pin = ""; failures++
            if (failures >= 5) { blockedUntil = SystemClock.elapsedRealtime() + 30_000; failures = 0; error = "Troppi tentativi. Riprova tra 30 secondi" }
            else error = "PIN non corretto"
        }
    }
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding().navigationBarsPadding().padding(horizontal = 26.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Image(painterResource(if (isDark) R.drawable.garage_logo_dark else R.drawable.garage_logo_light), contentDescription = "Garage", modifier = Modifier.size(74.dp))
        Spacer(Modifier.height(20.dp))
        Text("Garage protetto", color = MaterialTheme.colorScheme.onBackground, fontSize = 31.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(5.dp))
        Text(if (hasPin) "Inserisci il tuo PIN" else "Usa il blocco schermo del dispositivo", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(25.dp))
        if (hasPin) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat((pinLength.takeIf { it in 4..8 } ?: 6)) { index ->
                    Box(Modifier.size(12.dp).background(if (index < pin.length) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .45f), CircleShape))
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, minLines = 1)
            Spacer(Modifier.height(20.dp))
            listOf(listOf(1, 2, 3), listOf(4, 5, 6), listOf(7, 8, 9)).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    row.forEach { number -> PinKey(number.toString()) { digit(number) } }
                }
                Spacer(Modifier.height(10.dp))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                    if (biometric) TextButton(onClick = onBiometric) { Text("Bio", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp) }
                }
                PinKey("0") { digit(0) }
                PinKey("⌫") { if (pin.isNotEmpty()) { pin = pin.dropLast(1); error = "" } }
            }
        } else Button(onClick = onLegacyUnlock, modifier = Modifier.fillMaxWidth()) { Text("Sblocca") }
    }
}

@Composable private fun PinKey(label: String, onClick: () -> Unit) {
    Box(Modifier.size(64.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surface)
        .clickable(onClickLabel = if (label == "⌫") "Cancella cifra" else "Cifra $label", onClick = onClick), contentAlignment = Alignment.Center) {
        Text(label, color = MaterialTheme.colorScheme.onSurface, fontSize = 27.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable private fun PinSetupDialog(existingPin: Boolean, verifyPin: (String) -> Boolean, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var current by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(if (existingPin) "Cambia PIN" else "Imposta PIN") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Scegli un PIN da 4 a 8 cifre.")
            if (existingPin) OutlinedTextField(current, { current = it.filter(Char::isDigit).take(8); error = "" }, label = { Text("PIN attuale") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
            OutlinedTextField(pin, { pin = it.filter(Char::isDigit).take(8); error = "" }, label = { Text("Nuovo PIN") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
            OutlinedTextField(confirm, { confirm = it.filter(Char::isDigit).take(8); error = "" }, label = { Text("Conferma PIN") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword))
            if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        }
    }, confirmButton = { TextButton(onClick = {
        error = when { existingPin && !verifyPin(current) -> "PIN attuale non corretto"; pin.length !in 4..8 -> "Il PIN deve avere da 4 a 8 cifre"; pin != confirm -> "I PIN non coincidono"; else -> "" }
        if (error.isEmpty()) onSave(pin)
    }) { Text("Salva PIN") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } })
}

private fun copyPlate(context: Context, plate: String) { (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Targa", plate)) }
private fun pickedName(context: Context, uri: Uri): String = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null } ?: uri.lastPathSegment?.substringAfterLast('/') ?: "Documento"
private fun documentUri(context: Context, doc: GarageDocument): Uri {
    val dir = File(context.cacheDir, "shared-documents").apply { mkdirs() }
    val extension = when (doc.mimeType) { "application/pdf" -> ".pdf"; "image/jpeg" -> ".jpg"; "image/png" -> ".png"; else -> "" }
    val file = File(dir, doc.id + extension).apply { writeBytes(doc.data) }
    return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
}
private fun openDocument(context: Context, doc: GarageDocument) {
    runCatching {
        val uri = documentUri(context, doc)
        context.startActivity(Intent(Intent.ACTION_VIEW).apply { setDataAndType(uri, doc.mimeType); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) })
    }.onFailure { Toast.makeText(context, "Nessuna app disponibile per aprire questo file", Toast.LENGTH_LONG).show() }
}
private fun shareDocument(context: Context, doc: GarageDocument) {
    runCatching {
        val uri = documentUri(context, doc)
        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = doc.mimeType; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }, "Condividi documento"))
    }.onFailure { Toast.makeText(context, "Condivisione non disponibile", Toast.LENGTH_LONG).show() }
}

@Composable private fun Onboarding(done: () -> Unit) {
    val slides = listOf(
        "Il tuo garage,\nsempre con te." to "Auto, manutenzioni, documenti e scadenze in un unico spazio privato.",
        "Ogni auto ha\nla sua storia." to "Conserva targa, chilometri, foto e appunti nella scheda del veicolo.",
        "Interventi sotto\ncontrollo." to "Registra tagliandi, revisione, bollo, assicurazione e altri lavori.",
        "Documenti e\nscadenze." to "Archivia i file sul dispositivo e consulta i promemoria quando vuoi.",
        "Pronto a partire." to "I dati restano disponibili offline. Esporta un backup per portarli con te."
    )
    var step by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize().background(Black).statusBarsPadding().navigationBarsPadding().padding(28.dp), verticalArrangement = Arrangement.Center) {
        Image(painterResource(R.drawable.garage_logo_dark), contentDescription = "Garage", modifier = Modifier.size(100.dp))
        Spacer(Modifier.height(30.dp)); Text("0${step + 1} / 05", color = Gold, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(15.dp)); Text(slides[step].first, color = Cream, fontSize = 38.sp, fontWeight = FontWeight.Black, lineHeight = 40.sp)
        Spacer(Modifier.height(22.dp)); Text(slides[step].second, color = Muted)
        Spacer(Modifier.height(36.dp)); Button(onClick = { if (step == slides.lastIndex) done() else step++ }, colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Black), modifier = Modifier.fillMaxWidth()) { Text(if (step == slides.lastIndex) "Inizia subito" else "Continua") }
        TextButton(onClick = done, modifier = Modifier.fillMaxWidth()) { Text("Salta", color = Cream) }
    }
}

@Composable internal fun SectionHeading(kicker: String, title: String, subtitle: String = "") { Column(Modifier.padding(bottom = 20.dp)) {
    Text(kicker.uppercase(), color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
    Text(title, fontSize = 32.sp, lineHeight = 34.sp, fontWeight = FontWeight.Black)
    if (subtitle.isNotBlank()) Text(subtitle, color = MaterialTheme.colorScheme.secondary)
} }
@Composable internal fun InfoCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) { Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(24.dp)) { Column(Modifier.padding(18.dp), content = content) } }
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable private fun GarageHome(state: GarageState, add: () -> Unit, open: (String) -> Unit, sharedTransitionScope: SharedTransitionScope, animatedVisibilityScope: AnimatedVisibilityScope) {
    var archive by remember { mutableStateOf(false) }; var query by remember { mutableStateOf("") }
    val active = state.vehicles.filter { it.status == "active" }; val archived = state.vehicles.filter { it.status != "active" && "${it.name} ${it.make} ${it.plate}".contains(query, true) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 22.dp, bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { SectionHeading("Garage", "Le tue auto", "Un posto per ogni dettaglio della tua strada.") }
        item { val launchModifier = with(sharedTransitionScope) {
            Modifier.sharedBounds(rememberSharedContentState("add-vehicle-page"), animatedVisibilityScope,
                enter = fadeIn(tween(260)), exit = fadeOut(tween(300)),
                boundsTransform = BoundsTransform { _, _ -> tween(340, easing = FastOutSlowInEasing) })
        }
        Button(onClick = add, modifier = Modifier.fillMaxWidth().height(56.dp).then(launchModifier), shape = RoundedCornerShape(30.dp)) {
            Text("＋", fontSize = 27.sp, lineHeight = 27.sp, fontWeight = FontWeight.Light)
            Spacer(Modifier.width(9.dp))
            Text("Aggiungi auto", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        } }
        if (active.isEmpty()) item { InfoCard(Modifier.fillMaxWidth()) {
            Text(if (state.vehicles.isEmpty()) "Il garage è pronto." else "Nessuna auto attiva", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(if (state.vehicles.isEmpty()) "Aggiungi la tua prima auto per iniziare." else "Aggiungi un'auto o consulta l'archivio.", color = MaterialTheme.colorScheme.secondary)
        } }
        items(active, key = { it.id }) { VehicleCard(it, open, sharedTransitionScope, animatedVisibilityScope) }
        if (state.vehicles.any { it.status != "active" }) {
            item { TextButton(onClick = { archive = !archive }) { Text(if (archive) "Nascondi archivio" else "Mostra archivio (${state.vehicles.size - active.size})") } }
            if (archive) { item { OutlinedTextField(query, { query = it }, label = { Text("Cerca nell'archivio") }, modifier = Modifier.fillMaxWidth()) }; items(archived, key = { it.id }) { VehicleCard(it, open, sharedTransitionScope, animatedVisibilityScope) } }
        }
    }
}
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable private fun VehicleCard(v: Vehicle, open: (String) -> Unit, sharedTransitionScope: SharedTransitionScope, animatedVisibilityScope: AnimatedVisibilityScope) {
    val statusLabel = when (v.status) { "sold" -> "Venduta"; "scrapped" -> "Rottamata"; else -> "Attiva" }
    val accent = MaterialTheme.colorScheme.primary
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Card(Modifier.fillMaxWidth().clickable { open(v.id) }, shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), elevation = CardDefaults.cardElevation(defaultElevation = 5.dp)) {
        Column(Modifier.padding(8.dp)) {
            if (v.photo != null) {
                Box(Modifier.fillMaxWidth().height(166.dp).clip(RoundedCornerShape(19.dp))) {
                    val photoModifier = with(sharedTransitionScope) { Modifier.sharedElement(rememberSharedContentState("photo-${v.id}"), animatedVisibilityScope, boundsTransform = BoundsTransform { _, _ -> tween(300, easing = FastOutSlowInEasing) }).fillMaxSize() }
                    VehicleImage(v.photo, photoModifier)
                    val chipModifier = with(sharedTransitionScope) { with(animatedVisibilityScope) {
                        Modifier.renderInSharedTransitionScopeOverlay(zIndexInOverlay = 1f)
                            .animateEnterExit(enter = fadeIn(tween(150)), exit = fadeOut(tween(140)))
                    } }
                    Row(Modifier.align(Alignment.BottomStart).padding(9.dp).then(chipModifier).background(Color.Black.copy(alpha = .76f), RoundedCornerShape(50)).padding(horizontal = 11.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).background(if (v.status == "active") Color(0xFF2AD06D) else Color(0xFFB4B1AA), CircleShape))
                        Spacer(Modifier.width(6.dp))
                        Text(statusLabel, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            Column(Modifier.padding(horizontal = 10.dp, vertical = 11.dp)) {
                if (v.photo == null) {
                    Text(statusLabel.uppercase(Locale.ITALY), color = accent, fontSize = 11.sp, letterSpacing = 1.5.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(7.dp))
                }
                Text(v.plate.uppercase(Locale.ITALY), color = accent, fontSize = 12.sp, letterSpacing = 2.5.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(3.dp))
                val titleModifier = with(sharedTransitionScope) { Modifier.sharedBounds(rememberSharedContentState("title-${v.id}"), animatedVisibilityScope, enter = fadeIn(tween(180)), exit = fadeOut(tween(140)), boundsTransform = BoundsTransform { _, _ -> tween(300, easing = FastOutSlowInEasing) }) }
                Text(v.name, modifier = titleModifier, fontSize = 27.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("${v.make} ${v.model} · ${v.year}", color = muted, fontSize = 15.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(13.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Icon(painterResource(R.drawable.ic_speedometer), contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(v.mileage.formatKm(), color = muted, fontSize = 14.sp)
                    if (v.fuel.isNotBlank()) {
                        Spacer(Modifier.width(14.dp))
                        VerticalDivider(Modifier.height(18.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = .3f))
                        Spacer(Modifier.width(14.dp))
                        Icon(painterResource(R.drawable.ic_fuel), contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(v.fuel, color = muted, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Spacer(Modifier.height(5.dp))
            }
        }
    }
}
@Composable internal fun VehicleImage(data: ByteArray?, modifier: Modifier = Modifier) { val bitmap = remember(data) { data?.let { BitmapFactory.decodeByteArray(it, 0, it.size)?.asImageBitmap() } }
    if (bitmap != null) Box(modifier.clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
        Image(BitmapPainter(bitmap), contentDescription = "Foto auto", modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
    }
}
@Composable private fun ReminderScreen(state: GarageState, open: (String) -> Unit) { val list = dueReminders(state); LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 96.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item { SectionHeading("Agenda", "Scadenze", "Promemoria delle auto attive") }
    if (list.isEmpty()) item { InfoCard(Modifier.fillMaxWidth()) { Text("Nessuna scadenza da mostrare.") } }
    items(list) { item -> InfoCard(Modifier.fillMaxWidth().clickable { open(item.vehicle.id) }) {
        Text(item.vehicle.name, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Text(maintenanceLabel(item.maintenance), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(when { item.days == null -> "Data da verificare"; item.days < 0 -> "Scaduto"; item.days == 0L -> "Oggi"; else -> "Tra ${item.days} giorni" }, color = if ((item.days ?: 999) < 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)
        if (item.kmLeft != null) Text("${item.kmLeft} km alla soglia")
    } }
} }
internal fun Int.formatKm() = String.format(Locale.ITALY, "%,d km", this)
internal fun maintenanceLabel(m: Maintenance) = if (m.type == "custom") m.customName else mapOf("service" to "Tagliando", "inspection" to "Revisione", "tax" to "Bollo", "insurance" to "Assicurazione", "tires" to "Cambio gomme")[m.type] ?: m.type
internal fun dateLabel(value: String): String = runCatching { LocalDate.parse(value).format(DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ITALY)) }.getOrDefault(value.ifBlank { "—" })
