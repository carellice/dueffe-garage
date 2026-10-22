package it.dueffe.garage

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
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
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.Locale

// Brand palette shared by every screen: warm gold on deep graphite, amber as the second gradient stop.
internal val Amber = Color(0xFFFF9F1C)
internal val Ember = Color(0xFFFF6B3D)
internal val GoldGradient = Brush.linearGradient(listOf(Gold, Amber))
internal val LocalGarageDark = staticCompositionLocalOf { false }

@Composable internal fun accentGradient(): Brush = if (LocalGarageDark.current) GoldGradient
    else Brush.linearGradient(listOf(Color(0xFFE0A100), Color(0xFFE86A12)))

/** Page background: theme colour plus two slowly drifting warm glows. */
@Composable internal fun Modifier.garageBackdrop(): Modifier {
    val dark = LocalGarageDark.current
    val base = MaterialTheme.colorScheme.background
    val transition = rememberInfiniteTransition(label = "backdrop")
    val drift by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(9000, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "drift")
    val glowA = (if (dark) Gold else Color(0xFFFFC94D)).copy(alpha = if (dark) .10f else .22f)
    val glowB = (if (dark) Amber else Color(0xFFFFB38A)).copy(alpha = if (dark) .07f else .18f)
    return this.drawBehind {
        drawRect(base)
        val r = size.maxDimension * .55f
        val a = Offset(size.width * (.85f - .25f * drift), size.height * (.04f + .06f * drift))
        drawCircle(Brush.radialGradient(listOf(glowA, Color.Transparent), a, r), r, a)
        val b = Offset(size.width * (.08f + .2f * drift), size.height * (.62f - .08f * drift))
        drawCircle(Brush.radialGradient(listOf(glowB, Color.Transparent), b, r * .8f), r * .8f, b)
    }
}

/** Shrinks slightly while pressed, springing back on release. */
internal fun Modifier.pressScale(interaction: MutableInteractionSource, pressed: Float = .965f): Modifier = composed {
    val isPressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (isPressed) pressed else 1f, spring(dampingRatio = .55f, stiffness = Spring.StiffnessMedium), label = "press")
    graphicsLayer { scaleX = scale; scaleY = scale }
}

/** Clickable surface with a springy press feedback. */
internal fun Modifier.bouncyClick(onClickLabel: String? = null, role: Role? = null, onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    pressScale(interaction).clickable(interactionSource = interaction, indication = androidx.compose.material3.ripple(), onClickLabel = onClickLabel, role = role, onClick = onClick)
}

/** Fades and lifts content into place, staggered by [index]. */
internal fun Modifier.staggerIn(index: Int, baseDelay: Int = 40, enabled: Boolean = true): Modifier = composed {
    if (!enabled) return@composed this
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay((index.coerceAtMost(10) * baseDelay).toLong())
        progress.animateTo(1f, spring(dampingRatio = .82f, stiffness = Spring.StiffnessLow))
    }
    graphicsLayer {
        val p = progress.value
        alpha = p.coerceIn(0f, 1f)
        translationY = (1f - p) * 46.dp.toPx()
        scaleX = .96f + .04f * p; scaleY = scaleX
    }
}

/** Diagonal light sweep, used on primary buttons. */
internal fun Modifier.shimmer(enabled: Boolean = true): Modifier = composed {
    if (!enabled) return@composed this
    val transition = rememberInfiniteTransition(label = "shimmer")
    val x by transition.animateFloat(-1f, 2f, infiniteRepeatable(tween(2600, delayMillis = 900, easing = LinearEasing)), label = "sweep")
    drawWithContent {
        drawContent()
        val start = size.width * x
        drawRect(Brush.linearGradient(listOf(Color.Transparent, Color.White.copy(alpha = .28f), Color.Transparent),
            start = Offset(start - size.width * .35f, 0f), end = Offset(start, size.height)))
    }
}

@Composable internal fun GradientButton(
    onClick: () -> Unit, modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(28.dp),
    enabled: Boolean = true, contentPadding: PaddingValues = PaddingValues(horizontal = 20.dp), shine: Boolean = false,
    content: @Composable RowScope.() -> Unit
) {
    val interaction = remember { MutableInteractionSource() }
    val dark = LocalGarageDark.current
    val onAccent = if (dark) Black else Color.White
    Row(
        modifier.heightIn(min = 48.dp).pressScale(interaction)
            .shadow(if (enabled) 10.dp else 0.dp, shape, ambientColor = Amber, spotColor = Amber)
            .clip(shape).background(accentGradient()).shimmer(shine && enabled)
            .clickable(interactionSource = interaction, indication = androidx.compose.material3.ripple(color = Color.White), enabled = enabled, role = Role.Button, onClick = onClick)
            .graphicsLayer { alpha = if (enabled) 1f else .45f }
            .padding(contentPadding),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
    ) {
        CompositionLocalProvider(LocalContentColor provides onAccent) {
            androidx.compose.material3.ProvideTextStyle(MaterialTheme.typography.labelLarge.copy(color = onAccent, fontWeight = FontWeight.Bold, fontSize = 15.sp)) { content() }
        }
    }
}

/** Elevated card with a hairline border, the base surface of the redesign. */
@Composable internal fun GlassCard(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(26.dp), padding: Dp = 18.dp, content: @Composable ColumnScope.() -> Unit) {
    val dark = LocalGarageDark.current
    Column(
        modifier.shadow(if (dark) 0.dp else 8.dp, shape, spotColor = Color.Black.copy(alpha = .18f), ambientColor = Color.Black.copy(alpha = .08f))
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, if (dark) Color.White.copy(alpha = .07f) else Color.Black.copy(alpha = .05f), shape)
            .padding(padding), content = content
    )
}

/** Round icon badge filled with the brand gradient. */
@Composable internal fun GradientIcon(icon: Int, size: Dp = 46.dp, iconSize: Dp = 23.dp) {
    val dark = LocalGarageDark.current
    Box(Modifier.size(size).clip(CircleShape).background(accentGradient()), contentAlignment = Alignment.Center) {
        androidx.compose.material3.Icon(androidx.compose.ui.res.painterResource(icon), contentDescription = null,
            tint = if (dark) Black else Color.White, modifier = Modifier.size(iconSize))
    }
}

/** Number that counts up from zero when first shown. */
@Composable internal fun AnimatedCount(value: Number, style: TextStyle, modifier: Modifier = Modifier, animate: Boolean = true, format: (Double) -> String = { String.format(Locale.ITALY, "%,d", it.toLong()) }) {
    val target = value.toDouble()
    val anim = remember { Animatable(if (animate) 0f else 1f) }
    LaunchedEffect(target) { anim.animateTo(1f, tween(1100, easing = FastOutSlowInEasing)) }
    Text(format(target * anim.value), style = style, modifier = modifier, maxLines = 1)
}

/** Progress ring drawn behind [content], animated to [fraction]. */
@Composable internal fun ProgressRing(fraction: Float, color: Color, modifier: Modifier = Modifier, stroke: Dp = 5.dp, content: @Composable BoxScope.() -> Unit = {}) {
    val animated by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(1200, easing = FastOutSlowInEasing), label = "ring")
    val track = MaterialTheme.colorScheme.outline.copy(alpha = .16f)
    Box(modifier.drawBehind {
        val w = stroke.toPx()
        val inset = w / 2
        val arcSize = androidx.compose.ui.geometry.Size(size.width - w, size.height - w)
        drawArc(track, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(w))
        drawArc(color, -90f, 360f * animated, false, Offset(inset, inset), arcSize, style = Stroke(w, cap = StrokeCap.Round))
    }, contentAlignment = Alignment.Center, content = content)
}

/** Text filled with the brand gradient. */
@Composable internal fun GradientText(text: String, fontSize: androidx.compose.ui.unit.TextUnit, modifier: Modifier = Modifier, lineHeight: androidx.compose.ui.unit.TextUnit = fontSize * 1.08f) {
    Text(text, modifier = modifier, style = TextStyle(brush = accentGradient(), fontSize = fontSize, lineHeight = lineHeight, fontWeight = FontWeight.Black, letterSpacing = (-.5).sp))
}

/** Urgency palette for deadlines, readable in both themes. */
internal data class Urgency(val label: String, val color: Color)
@Composable internal fun urgencyFor(days: Long?): Urgency {
    val dark = LocalGarageDark.current
    return when {
        days == null -> Urgency("Da verificare", if (dark) Color(0xFFB7A98E) else Color(0xFF66563C))
        days < 0 -> Urgency("Scaduta", if (dark) Color(0xFFFF6B6B) else Color(0xFFC62828))
        days <= 30 -> Urgency("Imminente", if (dark) Color(0xFFFF9F43) else Color(0xFFD35400))
        days <= 100 -> Urgency("In arrivo", if (dark) Color(0xFFFFD84D) else Color(0xFF9A6B00))
        else -> Urgency("Tranquilla", if (dark) Color(0xFF5FD4A0) else Color(0xFF1E8A5A))
    }
}

@Composable internal fun garageTypography(): androidx.compose.material3.Typography {
    val base = androidx.compose.material3.Typography()
    return base.copy(
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.Black, letterSpacing = (-.5).sp),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.Black, letterSpacing = (-.4).sp),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = (-.2).sp),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.Bold, letterSpacing = .2.sp)
    )
}

/** Container transform: the element grows into the page that shares its [key], like "Aggiungi auto". */
@OptIn(androidx.compose.animation.ExperimentalSharedTransitionApi::class)
@Composable internal fun Modifier.containerTransform(
    key: String, sharedTransitionScope: androidx.compose.animation.SharedTransitionScope,
    animatedVisibilityScope: androidx.compose.animation.AnimatedVisibilityScope
): Modifier = with(sharedTransitionScope) {
    this@containerTransform.sharedBounds(rememberSharedContentState(key), animatedVisibilityScope,
        enter = androidx.compose.animation.fadeIn(tween(260)), exit = androidx.compose.animation.fadeOut(tween(300)),
        boundsTransform = androidx.compose.animation.BoundsTransform { _, _ -> tween(340, easing = FastOutSlowInEasing) })
}
