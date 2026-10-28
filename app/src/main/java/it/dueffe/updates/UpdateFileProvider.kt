package it.dueffe.updates

import androidx.core.content.FileProvider

/** Own class: two providers declared with the same class collapse into one, breaking the update URI. */
class UpdateFileProvider : FileProvider()
