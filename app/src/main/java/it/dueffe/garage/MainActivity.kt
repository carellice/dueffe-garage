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
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale


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
    var editVehicle by remember { mutableStateOf<Vehicle?>(null) }
    var newVehicle by remember { mutableStateOf(false) }
    var editMaintenance by remember { mutableStateOf<Maintenance?>(null) }
    var newMaintenance by remember { mutableStateOf(false) }
    var addDocument by remember { mutableStateOf(false) }
    var editDocument by remember { mutableStateOf<GarageDocument?>(null) }
    var openMaintenanceId by remember { mutableStateOf<String?>(null) }
    var openReminderId by remember { mutableStateOf<String?>(null) }
    var openDocumentId by remember { mutableStateOf<String?>(null) }
    var heroHidden by remember { mutableStateOf(false) }
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
    val scope = rememberCoroutineScope()
    val serverConfig by repo.serverStore.config.collectAsState()
    var serverOpen by remember { mutableStateOf(false) }
    /** A change through the repository: on the phone, or on the Garage server in server mode. [done] runs only when it was saved. */
    fun write(work: suspend () -> Boolean, done: () -> Unit) { scope.launch { if (work()) { refresh(); done() } } }
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
    LaunchedEffect(Unit) { repo.errors.collect { Toast.makeText(context, it, Toast.LENGTH_LONG).show() } }
    // Server mode: changes made on the web version or on other phones arrive every 30 seconds while the app is open.
    LaunchedEffect(lifecycleOwner, serverConfig) {
        if (serverConfig == null) return@LaunchedEffect
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                if (repo.refreshFromServer()) refresh()
                delay(30_000)
            }
        }
    }
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
    LaunchedEffect(selectedId) { heroHidden = false }
    BackHandler(serverOpen || newVehicle || editVehicle != null || newMaintenance || editMaintenance != null || addDocument || editDocument != null || openMaintenanceId != null || openReminderId != null || openDocumentId != null || selectedId != null || page != "garage") {
        lastTap = Offset.Unspecified
        when {
            serverOpen -> serverOpen = false
            newMaintenance || editMaintenance != null -> { newMaintenance = false; editMaintenance = null }
            addDocument || editDocument != null -> { addDocument = false; editDocument = null; documentUri = null; documentName = ""; documentError = ""; documentMaintenanceId = null }
            newVehicle || editVehicle != null -> { newVehicle = false; editVehicle = null; photoUri = null }
            openMaintenanceId != null -> openMaintenanceId = null
            openReminderId != null -> openReminderId = null
            openDocumentId != null -> openDocumentId = null
            selectedId != null -> selectedId = null
            else -> page = "garage"
        }
    }
    val isDark = when (theme) { "light" -> false; "dark" -> true; else -> androidx.compose.foundation.isSystemInDarkTheme() }
    // Light status bar icons over the car photo, whatever the theme.
    val overPhoto = selectedId != null && !serverOpen && !newVehicle && editVehicle == null && !newMaintenance && editMaintenance == null &&
        !addDocument && editDocument == null && openMaintenanceId == null && openReminderId == null && openDocumentId == null && !heroHidden
    LaunchedEffect(isDark, onboarding, overPhoto, locked) {
        val window = (context as MainActivity).window
        window.decorView.post {
            WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = !isDark && !onboarding && (!overPhoto || locked)
        }
    }
    val colors = if (isDark) darkColorScheme(
        primary = Ice, onPrimary = Carbon, background = Carbon, surface = CarbonPanel,
        surfaceContainerLowest = Carbon, surfaceContainerLow = CarbonPanel, surfaceContainer = CarbonPanel,
        surfaceContainerHigh = CarbonRaised, surfaceContainerHighest = Color(0xFF212733),
        surfaceVariant = CarbonRaised, onSurfaceVariant = Steel, outline = Color(0xFF5A6476),
        onBackground = Frost, onSurface = Frost, secondary = Steel,
        secondaryContainer = Ice.copy(alpha = .16f), onSecondaryContainer = Ice, error = Color(0xFFFF5A5F)
    ) else lightColorScheme(
        primary = IceDeep, onPrimary = Color.White, background = Color(0xFFF2F4F7), surface = Color.White,
        surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFF8F9FB),
        surfaceContainer = Color(0xFFF2F4F7), surfaceContainerHigh = Color(0xFFE9ECF1),
        surfaceContainerHighest = Color(0xFFE1E5EC), surfaceVariant = Color(0xFFE9ECF1),
        onSurfaceVariant = Color(0xFF5B6475), outline = Color(0xFF7A8496),
        onBackground = Color(0xFF0B0D12), onSurface = Color(0xFF0B0D12), secondary = Color(0xFF5B6475),
        secondaryContainer = Color(0xFFDCE9FB), onSecondaryContainer = Color(0xFF0A3D7A), error = Color(0xFFC62828)
    )
    CompositionLocalProvider(LocalGarageDark provides isDark) {
    MaterialTheme(colorScheme = colors, typography = garageTypography(), shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(16.dp), large = RoundedCornerShape(22.dp), extraLarge = RoundedCornerShape(28.dp))) {
        if (locked) {
            GarageLockScreen(hasPin = hasPin, pinLength = repo.pinLength, biometric = biometric && (context as MainActivity).canUseBiometrics(), isDark = isDark,
                verifyPin = repo::verifyPin, onUnlocked = { locked = false },
                onBiometric = { (context as MainActivity).authenticateBiometric({ locked = false }, ::message) },
                onLegacyUnlock = { (context as MainActivity).authenticate({ locked = false }, ::message) })
        } else if (onboarding) {
            Onboarding { repo.onboardingDone = true; onboarding = false }
        } else {
            Scaffold(
                containerColor = MaterialTheme.colorScheme.background,
                // Every screen handles the system bars itself, so photos can run under the status bar.
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
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
                    serverOpen -> GarageDestination("server")
                    newVehicle || editVehicle != null -> GarageDestination("vehicle-editor", selectedId)
                    newMaintenance || editMaintenance != null -> GarageDestination("maintenance-editor", selectedId)
                    addDocument || editDocument != null -> GarageDestination("document-editor", selectedId, editDocument?.id)
                    openMaintenanceId != null -> GarageDestination("maintenance-detail", selectedId, openMaintenanceId)
                    openReminderId != null -> GarageDestination("reminder-detail", selectedId, openReminderId)
                    openDocumentId != null -> GarageDestination("document-detail", selectedId, openDocumentId)
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
                            val depth = mapOf("garage" to 0, "scadenze" to 1, "impostazioni" to 1, "detail" to 2, "server" to 2,
                                "maintenance-detail" to 3, "reminder-detail" to 3, "document-detail" to 3,
                                "vehicle-editor" to 4, "maintenance-editor" to 4, "document-editor" to 4)
                            val goingBack = (depth[targetState.screen] ?: 0) < (depth[initialState.screen] ?: 0)
                            val pair = setOf(initialState.screen, targetState.screen)
                            val editor = (if (goingBack) initialState else targetState).screen.endsWith("editor")
                            val easing = FastOutSlowInEasing
                            when {
                                // Home <-> car: the photo flies between them, the rest crossfades.
                                pair == setOf("garage", "detail") -> fadeIn(tween(300, 60)) togetherWith fadeOut(tween(200))
                                // Editors rise from the bottom like a sheet and sink back.
                                editor && !goingBack -> (slideInVertically(tween(380, easing = easing)) { it / 7 } + fadeIn(tween(260))) togetherWith fadeOut(tween(200))
                                editor -> fadeIn(tween(220)) togetherWith (slideOutVertically(tween(300, easing = easing)) { it / 7 } + fadeOut(tween(220)))
                                // Deeper pages push in from the right; back pops them out.
                                !goingBack -> (slideInHorizontally(tween(380, easing = easing)) { it / 4 } + fadeIn(tween(300))) togetherWith
                                    (slideOutHorizontally(tween(380, easing = easing)) { -it / 10 } + fadeOut(tween(220)))
                                else -> (slideInHorizontally(tween(380, easing = easing)) { -it / 10 } + fadeIn(tween(300))) togetherWith
                                    (slideOutHorizontally(tween(340, easing = easing)) { it / 4 } + fadeOut(tween(200)))
                            }.using(SizeTransform(clip = false))
                        },
                        label = "garage_navigation"
                    ) { shown ->
                        val selected = state.vehicles.firstOrNull { it.id == shown.vehicleId }
                        Box(Modifier.fillMaxSize().cockpitBackdrop()) {
                        when (shown.screen) {
                        "server" -> ServerScreen(repo, onBack = { serverOpen = false }, onDataChanged = { refresh(); selectedId = null })
                        "vehicle-editor" -> VehicleEditor(editVehicle, photoUri, { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                            onDismiss = { newVehicle = false; editVehicle = null; photoUri = null }, onSave = { value ->
                                write({ repo.saveAsync(value) }) { newVehicle = false; editVehicle = null; photoUri = null; selectedId = value.id; message("Auto salvata") }
                            }, repo = repo)
                        "maintenance-editor" -> selected?.let { MaintenanceEditor(selected, editMaintenance,
                            state.reminders.firstOrNull { it.maintenanceId == editMaintenance?.id },
                            onDismiss = { newMaintenance = false; editMaintenance = null }, onSave = { m, r -> write({ repo.saveAsync(m, r) }) { newMaintenance = false; editMaintenance = null; message("Intervento salvato") } }) }
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
                                    val document = GarageDocument(id = previous?.id ?: java.util.UUID.randomUUID().toString(), vehicleId = selected.id,
                                        name = documentName.trim(), mimeType = mime, category = if (mime.startsWith("image/")) "image" else if (mime == "application/pdf") "pdf" else "document",
                                        size = bytes.size, data = bytes, addedAt = previous?.addedAt ?: now(), updatedAt = now(), maintenanceId = documentMaintenanceId)
                                    write({ repo.saveAsync(document) }) { addDocument = false; editDocument = null; documentUri = null; documentName = ""; documentError = ""; documentMaintenanceId = null; message("Documento salvato") }
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
                        "garage" -> GarageHome(state, add = { newVehicle = true }, open = { selectedId = it },
                            openReminder = { selectedId = it.vehicle.id; openReminderId = it.reminder.id },
                            openAgenda = { page = "scadenze" }, openSettings = { page = "impostazioni" },
                            sharedTransitionScope = this@SharedTransitionLayout, animatedVisibilityScope = this@AnimatedContent)
                        "detail" -> selected?.let { vehicle ->
                            VehiclePage(vehicle, state, backLabel = if (page == "scadenze") "Scadenze" else "Garage", onBack = { selectedId = null },
                                onEdit = { editVehicle = vehicle }, onStatus = { statusEdit = true }, onDelete = { deleteVehicle = vehicle },
                                onCopyPlate = { copyPlate(context, vehicle.plate); message("Targa copiata") },
                                onAddMaintenance = { newMaintenance = true }, onOpenMaintenance = { openMaintenanceId = it.id }, onOpenReminder = { openReminderId = it.reminder.id },
                                onAddDocument = { documentMaintenanceId = null; addDocument = true }, onOpenDocument = { openDocumentId = it.id }, onShareDocument = { shareDocument(context, it) },
                                onRenameDocument = { renameDocument = it }, onDeleteDocument = { deleteDocument = it },
                                onNotes = { notes -> write({ repo.saveAsync(vehicle.copy(notes = notes, notesUpdatedAt = now(), updatedAt = now())) }) { message("Note salvate") } }, onHeroHidden = { heroHidden = it },
                                sharedTransitionScope = this@SharedTransitionLayout, animatedVisibilityScope = this@AnimatedContent)
                        }
                        "scadenze" -> ReminderScreen(state, onBack = { page = "garage" }) { selectedId = it.vehicle.id; openReminderId = it.reminder.id }
                        else -> SettingsScreen(onBack = { page = "garage" }, theme = theme, changeTheme = { theme = it; repo.theme = it }, lastChange = repo.lastChangeAt, lastExport = repo.lastExportAt,
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
                            onOnboarding = { onboarding = true }, onClear = { write({ repo.clearAsync() }) { selectedId = null; message("Dati eliminati") } },
                            serverActive = serverConfig != null, onServer = { serverOpen = true })
                        }
                        }
                    }
                }
                // Content scrolling under the status bar fades out beneath it.
                if (!overPhoto) Box(Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars).background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(listOf(MaterialTheme.colorScheme.background, MaterialTheme.colorScheme.background.copy(alpha = .75f)))))
                }
            }
        }
        if (selected != null && statusEdit) StatusEditor(selected, { statusEdit = false }, { v -> write({ repo.saveAsync(v) }) { statusEdit = false; message("Stato aggiornato") } })
        deleteVehicle?.let { item -> ConfirmDelete("Eliminare ${item.name} e tutti i suoi dati?", { deleteVehicle = null }, { deleteVehicle = null; write({ repo.deleteVehicleAsync(item.id) }) { selectedId = null } }) }
        deleteMaintenance?.let { item -> ConfirmDelete("Eliminare questo intervento e il suo promemoria?", { deleteMaintenance = null }, { deleteMaintenance = null; write({ repo.deleteMaintenanceAsync(item.id) }) { if (openMaintenanceId == item.id) openMaintenanceId = null; if (openReminderId != null) openReminderId = null } }) }
        deleteReminder?.let { item -> ConfirmDelete("Eliminare questa scadenza? L'intervento resterà nel diario.", { deleteReminder = null }, { deleteReminder = null; write({ repo.deleteReminderAsync(item.id) }) { if (openReminderId == item.id) openReminderId = null } }) }
        deleteDocument?.let { item -> ConfirmDelete("Eliminare ${item.name}?", { deleteDocument = null }, { deleteDocument = null; write({ repo.deleteDocumentAsync(item.id) }) { if (openDocumentId == item.id) openDocumentId = null } }) }
        renameDocument?.let { item -> var name by remember(item.id) { mutableStateOf(item.name) }; AlertDialog(onDismissRequest = { renameDocument = null }, title = { Text("Rinomina documento") }, text = { OutlinedTextField(name, { name = it }, label = { Text("Nome") }) }, confirmButton = { TextButton(onClick = { if (name.isNotBlank()) write({ repo.saveAsync(item.copy(name = name.trim(), updatedAt = now())) }) { renameDocument = null } }) { Text("Salva") } }, dismissButton = { TextButton(onClick = { renameDocument = null }) { Text("Annulla") } }) }
        importedBytes?.let { bytes -> AlertDialog(onDismissRequest = { importedBytes = null }, title = { Text("Importa backup") }, text = { Text("$importSummary\n\n" + if (serverConfig != null) "L'importazione sostituirà tutti i dati del tuo account sul server Garage. Il file non è cifrato." else "L'importazione sostituirà tutti i dati attuali. Il file non è cifrato.") }, confirmButton = { TextButton(onClick = { importedBytes = null; scope.launch { runCatching { repo.importBackupAsync(bytes) }.onSuccess { refresh(); selectedId = null; message("Backup importato") }.onFailure { message("Importazione annullata: ${it.message}") } } }) { Text("Importa") } }, dismissButton = { TextButton(onClick = { importedBytes = null }) { Text("Annulla") } }) }
        documentToOpen?.let { doc -> LaunchedEffect(doc) { openDocument(context, doc); documentToOpen = null } }
        if (pinSetup) PinSetupDialog(existingPin = hasPin, verifyPin = repo::verifyPin, onDismiss = { pinSetup = false; pinSetupEnablesProtection = false }, onSave = { pin ->
            repo.setPin(pin); hasPin = true; pinSetup = false
            if (pinSetupEnablesProtection) { protection = true; repo.protectionEnabled = true; message("Protezione attivata") }
            else message("PIN aggiornato")
            pinSetupEnablesProtection = false
        })
    }
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

internal fun Int.formatKm() = String.format(Locale.ITALY, "%,d km", this)
internal fun maintenanceLabel(m: Maintenance) = if (m.type == "custom") m.customName else mapOf("service" to "Tagliando", "inspection" to "Revisione", "tax" to "Bollo", "insurance" to "Assicurazione", "tires" to "Cambio gomme")[m.type] ?: m.type
internal fun dateLabel(value: String): String = runCatching { LocalDate.parse(value).format(DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ITALY)) }.getOrDefault(value.ifBlank { "—" })
