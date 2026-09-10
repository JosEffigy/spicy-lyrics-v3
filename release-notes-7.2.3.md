Romaji word spacing now follows the Japanese phrase across lyric segments. Split verbs such as `age ru` join correctly, and colloquial negatives such as `shite ran nai` stay together. Independent words and particles keep their spaces.

Supplied lyrics use the same spacing rules where the readings agree. Repeated spaces are collapsed, including gaps split across timing segments.

Known, isolated kanji tokens can use the dictionary's contextual reading when the API supplies a conflicting reading. This addresses cases such as standalone wind appearing as `fu` instead of `kaze`, without replacing compound or direct-source readings. Uncertain readings still need source lyrics.
