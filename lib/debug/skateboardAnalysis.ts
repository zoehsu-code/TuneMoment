import type {
  AnalysisResult,
  ConfidenceScores,
  FinalOutputScores,
  MicroSegmentScores,
  SafetyScores,
  SceneUnderstandingScores,
  SegmentationScores,
  TimelineSegment,
} from '@/types';

/**
 * Saved excerpt of a real Gemini skateboard analysis.
 * The dry run reads this fixture. It does not call Gemini.
 *
 * Micro-score groups other than segmentation, eventSalience, and eventScore
 * were not part of this excerpt. They are zero or empty so the production
 * `MicroSegmentScores` type is satisfied. `extractTemporalEvents` does not read them.
 */
export const SKATEBOARD_DURATION_SECONDS = 15.68;

interface SavedActionScores {
  actionStartTime: number;
  actionPeakTime: number;
  actionEndTime: number;
  eventSalience: number;
  eventScore: number;
}

function microScores(saved: SavedActionScores): MicroSegmentScores {
  const segmentation: SegmentationScores = {
    shotChanges: 0,
    sceneChanges: 0,
    actionStartTime: saved.actionStartTime,
    actionPeakTime: saved.actionPeakTime,
    actionEndTime: saved.actionEndTime,
    segmentOverlap: 0,
  };
  const sceneUnderstanding: SceneUnderstandingScores = {
    sceneCategory: '',
    environmentType: '',
    indoorOutdoor: '',
    activityType: '',
    actionComplexity: 0,
    eventDensity: 0,
    eventSalience: saved.eventSalience,
    sceneContextConsistency: 0,
    narrativeCoherence: 0,
    causeEffectClarity: 0,
  };
  const finalOutputs: FinalOutputScores = {
    segmentScore: 0,
    eventScore: saved.eventScore,
    technicalScore: 0,
    aestheticScore: 0,
    engagementScore: 0,
    taskScore: 0,
    penaltyScore: 0,
    confidenceAdjustedScore: 0,
    finalClipScore: 0,
  };
  const confidence: ConfidenceScores = {
    modelConfidence: 0,
    predictionEntropy: 0,
    ambiguityScore: 0,
    missingDataRate: 0,
    boundaryConfidence: 0,
    crossFrameConsistency: 0,
    reliabilityScore: 0,
  };
  const safety: SafetyScores = {
    nsfwRisk: 0,
    violenceRisk: 0,
    privacyRisk: 0,
    harmfulContentRisk: 0,
    illegalContentRisk: 0,
    faceSensitivity: 0,
    moderationPenalty: 0,
  };

  return {
    segmentation,
    visualQuality: {
      sharpness: 0,
      focusQuality: 0,
      exposure: 0,
      contrast: 0,
      brightnessStability: 0,
      colorBalance: 0,
      saturation: 0,
      noiseLevel: 0,
      compressionArtifacts: 0,
      motionBlur: 0,
      flicker: 0,
      distortion: 0,
    },
    subjectAnalysis: {
      primarySubjectDetected: 0,
      secondarySubjectCount: 0,
      objectCount: 0,
      subjectVisibility: 0,
      occlusionLevel: 0,
      faceVisibility: 0,
      bodyVisibility: 0,
      objectRelevance: 0,
      subjectSizeInFrame: 0,
      subjectCentering: 0,
    },
    motionAnalysis: {
      globalMotionIntensity: 0,
      localMotionIntensity: 0,
      cameraShake: 0,
      motionSmoothness: 0,
      motionDirectionConsistency: 0,
      movementSpeed: 0,
      movementPrecision: 0,
      movementSymmetry: 0,
      jerkiness: 0,
      trajectoryCoherence: 0,
    },
    sceneUnderstanding,
    attentionEngagement: {
      hookStrength: 0,
      visualInterest: 0,
      pacing: 0,
      retentionPotential: 0,
      novelty: 0,
      emotionalImpact: 0,
      memorability: 0,
      scrollStoppingPower: 0,
      rewatchability: 0,
      energyLevel: 0,
    },
    taskSpecific: {
      taskRelevance: 0,
      classificationAccuracy: 0,
      techniqueQuality: 0,
      timingAccuracy: 0,
      completionQuality: 0,
      successProbability: 0,
      goalAlignment: 0,
      rankingScore: 0,
    },
    audio: {
      speechPresence: 0,
      speechClarity: 0,
      backgroundNoiseLevel: 0,
      musicPresence: 0,
      soundEffectPresence: 0,
      audioVisualSync: 0,
      rhythmAlignment: 0,
      toneMatch: 0,
    },
    confidence,
    safety,
    finalOutputs,
  };
}

const timeline: TimelineSegment[] = [
  {
    startSeconds: 0,
    endSeconds: 4,
    mood: 'suspenseful',
    energyLevel: 'low',
    label: 'Anticipation at the pier',
    musicalDescription: 'muted bass groove and hi-hat, mp, tight anticipatory feel',
    transitionToNext: 'drum fill explodes into driving tempo',
    narrativeRole: 'intro',
    microScores: microScores({
      actionStartTime: 0,
      actionPeakTime: 0.5,
      actionEndTime: 1,
      eventSalience: 0.5,
      eventScore: 0.65,
    }),
  },
  {
    startSeconds: 4,
    endSeconds: 9,
    mood: 'energetic',
    energyLevel: 'high',
    label: 'Ramp approach and mid-air flip',
    musicalDescription: 'fast power chords and pounding drums, ff, aggressive punk momentum',
    transitionToNext: 'cymbal crash resolves into open chords',
    narrativeRole: 'climax',
    microScores: microScores({
      actionStartTime: 0.1,
      actionPeakTime: 0.6,
      actionEndTime: 0.95,
      eventSalience: 0.95,
      eventScore: 0.95,
    }),
  },
  {
    startSeconds: 9,
    endSeconds: SKATEBOARD_DURATION_SECONDS,
    mood: 'happy',
    energyLevel: 'medium',
    label: 'Splash and aftermath',
    musicalDescription: 'distorted rhythm guitar chords, mf, triumphant and lighthearted resolution',
    narrativeRole: 'resolution',
    microScores: microScores({
      actionStartTime: 0,
      actionPeakTime: 0.2,
      actionEndTime: 0.8,
      eventSalience: 0.6,
      eventScore: 0.7,
    }),
  },
];

export const skateboardAnalysis: AnalysisResult = {
  videoPath: '',
  metadata: {
    filename: 'skateboard.mp4',
    sizeBytes: 0,
    durationSeconds: SKATEBOARD_DURATION_SECONDS,
  },
  analysis: {
    mood: 'energetic',
    energyLevel: 'high',
    pace: 'fast',
    bpm: 135,
    genre: 'punk',
    sceneCount: timeline.length,
    motionScore: 0,
    instrumentSuggestions: [
      'distorted electric guitar',
      'electric bass',
      'acoustic drums',
      'crash cymbals',
    ],
    analysisSummary: 'Anticipation at the pier, a ramp flip, then splash and aftermath.',
    timeline,
  },
};
