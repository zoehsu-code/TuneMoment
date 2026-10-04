/**
 * Appended to the Gemini video-analysis prompt.
 * Gemini owns musical and narrative decisions. Timestamps in this object are
 * absolute seconds from the start of the video, unlike timeline actionPeakTime
 * values, which stay relative to their segment.
 */
export const COMPOSITION_PLAN_SCHEMA = `"compositionPlan": {
    "musicalIdentity": {
      "genre": "<same genre list as above>",
      "bpm": <integer 60-160>,
      "keyOrTonalCharacter": "<key or tonal character, e.g. minor, D dorian, bright major>",
      "instrumentation": ["<instrument plus playing technique>"],
      "rhythmicCharacter": "<groove, percussion behavior, and bass movement>",
      "harmonicCharacter": "<harmonic language>",
      "melodicCharacter": "<melodic language>",
      "texture": "<density, timbre, and space>",
      "overallArc": "<the global musical story, naming where the single strongest impact occurs>"
    },
    "syncEvents": [
      {
        "timeSeconds": <absolute seconds from the start of the video>,
        "label": "<what happens>",
        "importance": <float 0.0-1.0>,
        "role": "<primary_impact | secondary_accent | structural_transition | build_start | release_start>",
        "reason": "<why this role follows from the whole video>"
      }
    ],
    "primaryEvent": {
      "timeSeconds": <absolute seconds, identical to the single primary_impact>,
      "label": "<string>",
      "reason": "<why this moment should dominate the score>"
    },
    "positive_global_styles": ["<musical identity only: genre, tempo, instruments, tonal character, groove, production. Do not locate the climax here>"],
    "negative_global_styles": ["<global avoids such as lyrics and spoken word>"],
    "sections": [
      {
        "section_name": "<string>",
        "start_seconds": <absolute seconds>,
        "end_seconds": <absolute seconds>,
        "duration_ms": <integer milliseconds, equal to (end_seconds - start_seconds) * 1000>,
        "narrative_function": "<what this section does in the global arc>",
        "positive_local_styles": ["<concrete instrumentation, technique, rhythm, harmony, texture, and the dynamic level that belongs at THIS point in the hierarchy>"],
        "negative_local_styles": ["<what this section must not do>"]
      }
    ]
  }`;

export const COMPOSITION_PLAN_RULES = `
Temporally aligned composition plan:
- Add the compositionPlan object inside the same JSON object. It is the plan a composer would hand to a music model. Analyze the entire video before choosing section boundaries. The score must reflect the global narrative hierarchy, not a mood label for each scene in isolation.
- compositionPlan times are absolute seconds from 0 to videoDurationSeconds. They are not the relative 0-1 actionStartTime, actionPeakTime, or actionEndTime values inside a timeline segment.
- Identify the visual moments that deserve explicit musical synchronization. For each one, output timeSeconds, label, importance from 0 to 1, role, and reason. Allowed roles are only primary_impact, secondary_accent, structural_transition, build_start, and release_start.
- There is at most one primary_impact. primaryEvent must match that event. Use primaryEvent null only when no moment should perceptually dominate the score.
- The primary_impact is the single visual moment that should receive the strongest perceptual musical impact in the entire score. Do not treat the maximum-motion frame or actionPeakTime as that moment automatically. eventSalience and eventScore describe a segment. actionPeakTime is only the strongest action point inside that segment. A fast or airborne action can deserve a secondary_accent while a later payoff, impact, or change in the story deserves the primary hit. Reason from this video. Do not copy any example mechanically.
- Choose the primary event by narrative payoff, cause and effect, semantic weight, emotional importance, physical impact, and whether the moment resolves tension or turns the story. The strongest musical impact must occur at that exact timestamp.
- Keep the music richly arranged. Name genre, tempo, tonal character, instruments, playing techniques, groove, percussion, bass movement, harmony, melody, timbre, density, texture, dynamics, and how the piece develops. Do not collapse the score into quiet, then build, then boom, then quiet.
- Before the primary event, the music may develop, change instrumentation, and carry secondary accents, but it must not reach maximum intensity or describe another event as an equal climax. If a musical description before the primary event would say fff climax, maximum intensity, explosive climax, massive final hit, or strongest impact, keep the instrumentation, rhythm, timbre, and harmony, and rewrite the dynamic so the maximum peak is reserved for the primary event.
- At the primary event, ask for the strongest arrival the genre supports, immediately at the timestamp. If that timestamp is a section boundary, the impact is the first thing in the new section, not several seconds later. It must perceptually dominate every secondary event.
- After the primary event, release, resolve, or continue in a way that follows the video. Do not create a second climax that is equally strong.
- Secondary events still affect the music: a drum accent, bass accent, harmonic accent, cymbal, rhythmic interruption, or short melodic gesture. Describe them as secondary and clearly weaker than the primary event. Do not call a secondary event a climax, maximum intensity, the strongest hit, or a massive impact.
- Place section boundaries where they express a structural transition, the start of a build, the primary impact, the start of a release, or a real narrative change. Do not add a boundary merely because an actionPeak exists.
- Every section is at least 3 seconds and at most 120 seconds. Sections are ordered, do not overlap, and together cover 0 through videoDurationSeconds with no gaps. duration_ms equals the section length in milliseconds.
- If two important moments are too close for two legal sections, keep the more important one as the structural boundary and write the other as an internal accent inside the section that contains it. Never move the primary event to make another boundary fit. A secondary moment about two seconds before the primary impact stays inside the preceding section. The primary timestamp stays the boundary.
- Use negative_local_styles to protect that hierarchy, and write different constraints for different sections. Before the primary event, forbid a premature climax, maximum intensity, an explosive final hit, an early resolution, and a competing climax when those would undermine the plan. At the primary event, forbid a delayed climax, a weak entrance, and a stronger impact later in the section. After it, forbid a second climax and a return to maximum intensity when the video has moved on. Adapt the words to this piece. Do not paste the same negative list into every section.
- positive_global_styles describe musical identity: genre, BPM, instrumentation, tonal character, groove, production, and the overall emotional character. Do not put an ambiguous "build to fff climax" in the global styles. Say exactly where maximum intensity occurs in the local section styles, in one place.
- Before returning the JSON, privately check: which single moment should be the musical sync point; whether it is the narrative, emotional, or physical payoff rather than merely peak motion; whether the strongest impact sits exactly there; whether any earlier section sounds equally climactic; whether any later section creates a second climax; whether secondary events are still present and clearly weaker; whether instrumentation, rhythm, harmony, texture, timbre, and development are still specific; whether this is one composition rather than a stack of sound effects; and whether section boundaries are musically meaningful rather than copies of actionPeak timestamps. If a check fails, revise the plan. Do not output this checklist or any other prose. Return only the JSON object.`;
