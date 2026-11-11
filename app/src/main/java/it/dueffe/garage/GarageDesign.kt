package it.dueffe.garage

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.Locale

// ── Cockpit palette: carbon surfaces, frost text, one ice-blue accent. Urgency keeps its own colours. ──
internal val Ice = Color(0xFF6FD3FF)
internal val IceDeep = Color(0xFF0A66D0)
internal val Carbon = Color(0xFF07090C)
internal val CarbonPanel = Color(0xFF10141A)
internal val CarbonRaised = Color(0xFF181D25)
internal val Frost = Color(0xFFEEF1F5)
internal val Steel = Color(0xFF8B95A7)
internal val LocalGarageDark = staticCompositionLocalOf { false }

/** Text colour on the accent. */
@Composable internal fun onAccent(): Color = if (LocalGarageDark.current) Carbon else Color.White

/** Hairline used by every panel border. */
@Composable internal fun hairline(): Color = if (LocalGarageDark.current) Color.White.copy(alpha = .07f) else Color.Black.copy(alpha = .07f)

/** Page background: theme colour with one faint accent glow at the top, like a lit dashboard. */
@Composable internal fun Modifier.cockpitBackdrop(): Modifier {
    val dark = LocalGarageDark.current
    val base = MaterialTheme.colorScheme.background
    val glow = MaterialTheme.colorScheme.primary.copy(alpha = if (dark) .09f else .06f)
    return this.drawBehind {
        drawRect(base)
        val r = size.width * 1.1f
        val c = Offset(size.width * .5f, -size.width * .35f)
        drawCircle(Brush.radialGradient(listOf(glow, Color.Transparent), c, r), r, c)
    }
}

/** Shrinks slightly while pressed, springing back on release. */
internal fun Modifier.pressScale(interaction: MutableInteractionSource, pressed: Float = .97f): Modifier = composed {
    val isPressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) pressed else 1f, spring(dampingRatio = .6f, stiffness = Spring.StiffnessMedium), label = "press")
    graphicsLayer { scaleX = scale; scaleY = scale }
}

/** Clickable surface with a springy press feedback. */
internal fun Modifier.bouncyClick(onClickLabel: String? = null, role: Role? = null, onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    pressScale(interaction).clickable(interactionSource = interaction, indication = ripple(), onClickLabel = onClickLabel, role = role, onClick = onClick)
}

/** Fades and lifts content into place, staggered by [index]. Short and calm: a dashboard powering on. */
internal fun Modifier.staggerIn(index: Int, baseDelay: Int = 45, enabled: Boolean = true): Modifier = composed {
    if (!enabled) return@composed this
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay((index.coerceAtMost(8) * baseDelay).toLong())
        progress.animateTo(1f, tween(420, easing = FastOutSlowInEasing))
    }
    graphicsLayer {
        val p = progress.value
        alpha = p
        translationY = (1f - p) * 18.dp.toPx()
    }
}

/** The base surface: flat panel with a hairline border. Clickable when [onClick] is given. */
@Composable internal fun Panel(
    modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(20.dp), padding: Dp = 18.dp,
    onClickLabel: String? = null, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier.clip(shape).background(MaterialTheme.colorScheme.surface).border(1.dp, hairline(), shape)
            .then(if (onClick != null) Modifier.bouncyClick(onClickLabel = onClickLabel, onClick = onClick) else Modifier)
            .padding(padding), content = content
    )
}

/** Primary action: solid accent, precise corners. */
@Composable internal fun AccentButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(16.dp),
    enabled: Boolean = true, contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp),
    content: @Composable RowScope.() -> Unit
) {
    val interaction = remember { MutableInteractionSource() }
    val fg = onAccent()
    Row(
        modifier.heightIn(min = 52.dp).pressScale(interaction).clip(shape)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = if (enabled) 1f else .4f))
            .clickable(interactionSource = interaction, indication = ripple(color = fg), enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(contentPadding),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
    ) {
        CompositionLocalProvider(LocalContentColor provides fg) {
            ProvideTextStyle(MaterialTheme.typography.labelLarge.copy(color = fg, fontWeight = FontWeight.Bold, fontSize = 15.sp)) { content() }
        }
    }
}

/** Secondary action: hairline outline; [danger] tints it with the error colour. */
@Composable internal fun GhostButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, danger: Boolean = false, enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(16.dp)
    val fg = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    Row(
        modifier.heightIn(min = 52.dp).pressScale(interaction).clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (danger) fg.copy(alpha = .35f) else MaterialTheme.colorScheme.outline.copy(alpha = .35f), shape)
            .clickable(interactionSource = interaction, indication = ripple(), enabled = enabled, role = Role.Button, onClick = onClick)
            .graphicsLayer { alpha = if (enabled) 1f else .45f }
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
    ) {
        CompositionLocalProvider(LocalContentColor provides fg) {
            ProvideTextStyle(MaterialTheme.typography.labelLarge.copy(color = fg, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)) { content() }
        }
    }
}

/** Round icon button. [overPhoto] gives it a dark translucent fill to sit on images. */
@Composable internal fun RoundIconButton(icon: Int, description: String, onClick: () -> Unit, modifier: Modifier = Modifier, overPhoto: Boolean = false, accent: Boolean = false) {
    val bg = when { accent -> MaterialTheme.colorScheme.primary; overPhoto -> Color.Black.copy(alpha = .42f); else -> MaterialTheme.colorScheme.surface }
    val fg = when { accent -> onAccent(); overPhoto -> Color.White; else -> MaterialTheme.colorScheme.onSurface }
    Box(modifier.size(46.dp).clip(CircleShape).background(bg)
        .border(1.dp, if (overPhoto) Color.White.copy(alpha = .16f) else if (accent) Color.Transparent else hairline(), CircleShape)
        .bouncyClick(onClickLabel = description, role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(painterResource(icon), contentDescription = description, tint = fg, modifier = Modifier.size(22.dp))
    }
}

/** Small uppercase label, the voice of instrument panels. */
@Composable internal fun Overline(text: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(text.uppercase(Locale.ITALY), modifier = modifier, color = color, fontSize = 11.sp, letterSpacing = 1.8.sp, fontWeight = FontWeight.Bold, maxLines = 1)
}

/** Section title with an optional action on the right. */
@Composable internal fun SectionTitle(title: String, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, letterSpacing = (-.2).sp, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) Text(action, color = MaterialTheme.colorScheme.primary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.clip(RoundedCornerShape(10.dp)).bouncyClick(role = Role.Button, onClick = onAction).padding(horizontal = 8.dp, vertical = 6.dp))
    }
}

/** Icon in a soft square tinted badge. */
@Composable internal fun TintBadge(icon: Int, tint: Color, background: Color, size: Dp = 44.dp, iconSize: Dp = 22.dp) {
    Box(Modifier.size(size).clip(RoundedCornerShape(size * .32f)).background(background), contentAlignment = Alignment.Center) {
        Icon(painterResource(icon), contentDescription = null, tint = tint, modifier = Modifier.size(iconSize))
    }
}

/** Accent icon badge. */
@Composable internal fun AccentBadge(icon: Int, size: Dp = 44.dp, iconSize: Dp = 22.dp) {
    val accent = MaterialTheme.colorScheme.primary
    TintBadge(icon, accent, accent.copy(alpha = .13f), size, iconSize)
}

/** Number that counts up from zero when first shown. */
@Composable internal fun AnimatedCount(value: Number, style: TextStyle, modifier: Modifier = Modifier, animate: Boolean = true, format: (Double) -> String = { String.format(Locale.ITALY, "%,d", it.toLong()) }) {
    val target = value.toDouble()
    val anim = remember { Animatable(if (animate) 0f else 1f) }
    LaunchedEffect(target) { anim.animateTo(1f, tween(900, easing = FastOutSlowInEasing)) }
    Text(format(target * anim.value), style = style, modifier = modifier, maxLines = 1)
}

/** Speedometer-style 270° gauge drawn behind [content], sweeping to [fraction]. */
@Composable internal fun Gauge(fraction: Float, color: Color, modifier: Modifier = Modifier, stroke: Dp = 5.dp, content: @Composable BoxScope.() -> Unit = {}) {
    val animated by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(1100, easing = FastOutSlowInEasing), label = "gauge")
    val track = MaterialTheme.colorScheme.outline.copy(alpha = .18f)
    Box(modifier.drawBehind {
        val w = stroke.toPx()
        val arc = Size(size.width - w, size.height - w)
        val topLeft = Offset(w / 2, w / 2)
        drawArc(track, 135f, 270f, false, topLeft, arc, style = Stroke(w, cap = StrokeCap.Round))
        if (animated > 0f) drawArc(color, 135f, 270f * animated, false, topLeft, arc, style = Stroke(w, cap = StrokeCap.Round))
    }, contentAlignment = Alignment.Center, content = content)
}

/** How full a deadline gauge is: empty a year away, full when due. */
internal fun deadlineFraction(days: Long?): Float = when { days == null -> 0f; days <= 0 -> 1f; else -> (1f - days / 365f).coerceIn(.04f, 1f) }

/** Urgency palette for deadlines, readable in both themes. */
internal data class Urgency(val label: String, val color: Color)
@Composable internal fun urgencyFor(days: Long?): Urgency {
    val dark = LocalGarageDark.current
    return when {
        days == null -> Urgency("Da verificare", if (dark) Steel else Color(0xFF5B6475))
        days < 0 -> Urgency("Scaduta", if (dark) Color(0xFFFF5A5F) else Color(0xFFC62828))
        days <= 30 -> Urgency("Imminente", if (dark) Color(0xFFFFA24C) else Color(0xFFC75000))
        days <= 100 -> Urgency("In arrivo", if (dark) Color(0xFFFFD45C) else Color(0xFF8F6A00))
        else -> Urgency("Tranquilla", if (dark) Color(0xFF4FE0A6) else Color(0xFF138A57))
    }
}

/** A small coloured dot plus label, the status light of the dashboard. */
@Composable internal fun StatusPill(label: String, color: Color, modifier: Modifier = Modifier, onPhoto: Boolean = false) {
    Row(modifier.clip(RoundedCornerShape(50)).background(if (onPhoto) Color.Black.copy(alpha = .45f) else color.copy(alpha = .13f))
        .padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).background(color, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(label, color = if (onPhoto) Color.White else color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable internal fun garageTypography(): androidx.compose.material3.Typography {
    val base = androidx.compose.material3.Typography()
    return base.copy(
        displaySmall = base.displaySmall.copy(fontWeight = FontWeight.Bold, letterSpacing = (-1).sp),
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = (-.8).sp),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = (-.6).sp),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = (-.2).sp),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = .2.sp)
    )
}

/** Tabular figures so counters and kilometres don't jitter. */
internal val Numeric = TextStyle(fontFeatureSettings = "tnum")
