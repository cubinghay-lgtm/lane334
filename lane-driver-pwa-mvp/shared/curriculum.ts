/**
 * Lane curriculum: one lesson per clip in the team's Drive video folder, each
 * paired with a knowledge check aligned to the California Driver's Handbook.
 *
 * Every lesson carries three questions:
 *   quiz             — the first answer (C1)
 *   similarQuestion  — the follow-up after a miss ("Almost. Here is the rule…")
 *   harderQuestion   — the confirmation used by "I already know this" test-outs
 */

export type QuestionType = "multiple_choice" | "fill_blank" | "qte";

export interface FollowUpQuestion {
  type?: "multiple_choice" | "fill_blank";
  prompt: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation: string;
}

export interface QteAction {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  /** Extra accepted spellings for fill-in-the-blank answers (case-insensitive). */
  acceptableAnswers?: string[];
  explanation: string;
  /** Healthy answer time b for the time-quality score; defaults to 25s. */
  expectedSeconds?: number;
  similarQuestion: FollowUpQuestion;
  harderQuestion: FollowUpQuestion;
  qteConfig?: {
    scenario: string;
    targetAction: string;
    timeLimitSeconds: number;
    hazardDescription: string;
    visual: "intersection" | "siren" | "lane-change" | "blind-curve";
    actions: QteAction[];
  };
}

export interface LessonItem {
  id: string;
  topicId: string;
  category: "rules" | "weather" | "awareness" | "freeway" | "safety";
  title: string;
  /** Google Drive file in the shared Lane video folder. */
  driveFileId: string;
  videoUrl: string;
  videoTitle: string;
  videoDescription: string;
  /**
   * Second where the tested rule appears. Optional: when unknown the player
   * treats the middle of the clip (40–60%) as the key segment.
   */
  keyTimestampSeconds?: number;
  /** Shown on the card when the clip was filmed outside California. */
  localizationNote?: string;
  caHandbookRef: string;
  handbookSummary: string;
  impactReason: string;
  safetyWeight: number; // 0.50 to 1.00
  /** Safety-critical: the topic only counts as complete after a correct answer. */
  requiresKnowledgeCheck: boolean;
  quiz: QuizQuestion;
}

const drive = (id: string) => `https://drive.google.com/file/d/${id}/view`;

export const LESSON_SEEDS: LessonItem[] = [
  {
    id: "lesson-01",
    topicId: "lane-drop",
    category: "rules",
    title: "Ending Lanes & Merging Safely",
    driveFileId: "1y1U5BCeFNiUPPqBiIThisrB8gfkTYjow",
    videoUrl: drive("1y1U5BCeFNiUPPqBiIThisrB8gfkTYjow"),
    videoTitle: "Scanning Ahead for Lane-End Warnings",
    videoDescription:
      "Scan ahead, across the roadway, and for warning signs. A right-lane-ends sign shows why early information helps you plan a smooth, lawful lane change instead of a last-minute move.",
    caHandbookRef: "California Driver's Handbook — Merging and Lane Changes; CVC §22107",
    handbookSummary:
      "Merge into the continuing lane using turn signals, mirror checks, and a quick shoulder look without cutting off traffic.",
    impactReason: "Addresses sideswipe and merge compression crashes at highway lane drops.",
    safetyWeight: 0.85,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-01",
      type: "multiple_choice",
      prompt: "Your lane is ending ahead. What is the lawful California driving action?",
      options: [
        "Speed up to beat the car next to you",
        "Signal early, check mirrors and blind spot, and merge into a safe gap",
        "Stop immediately at the start of the taper",
        "Drive onto the right shoulder until traffic clears",
      ],
      correctAnswer: "Signal early, check mirrors and blind spot, and merge into a safe gap",
      explanation:
        "Signal early, check your mirrors and over your shoulder, and adjust speed to fit into a safe gap — through traffic does not have to make room for you.",
      similarQuestion: {
        prompt: "You see a 'RIGHT LANE ENDS' sign a quarter mile ahead. When should you start planning your merge?",
        options: [
          "Right away — signal and look for a gap early",
          "Only when you reach the very end of the lane",
          "After the lane has fully disappeared",
          "Never — the other lane must let you in",
        ],
        correctAnswer: "Right away — signal and look for a gap early",
        explanation: "Warning signs give you time. Use it: signal, scan, and merge early instead of forcing a last-second move.",
      },
      harderQuestion: {
        prompt: "If another vehicle is already pacing directly next to your rear bumper as your lane tapers, you must:",
        options: [
          "Force entry because ending lanes have right of way",
          "Ease off accelerator to slip into the opening behind them",
          "Slam on brakes immediately",
          "Honk until they move over",
        ],
        correctAnswer: "Ease off accelerator to slip into the opening behind them",
        explanation: "Entering vehicles must adjust speed and yield to through traffic.",
      },
    },
  },
  {
    id: "lesson-02",
    topicId: "collision-steps",
    category: "safety",
    title: "After a Collision: Required Next Steps",
    driveFileId: "1qjyFTyyytH1x8DTrpvr60TkarBCexzQR",
    videoUrl: drive("1qjyFTyyytH1x8DTrpvr60TkarBCexzQR"),
    videoTitle: "After a Collision: California's Required Next Steps",
    videoDescription:
      "Stop, check for injuries, move out of traffic only if no one is hurt, call 911, exchange required identification and insurance information, and complete required reports.",
    localizationNote:
      "California thresholds: report to the DMV (form SR-1) within 10 days if anyone was hurt or killed, or damage is over $1,000. If anyone was hurt, CHP or police must get a report within 24 hours.",
    caHandbookRef: "California Driver's Handbook — Collisions; CVC §20001, §20008, §16000",
    handbookSummary:
      "Stop at the scene, help the injured and call 911, exchange license, registration and insurance details, and file an SR-1 with the DMV within 10 days when required.",
    impactReason: "Leaving the scene or skipping a report turns a crash into a crime and can suspend a new license.",
    safetyWeight: 0.9,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-02",
      type: "fill_blank",
      prompt:
        "In California, you must report a collision to the DMV within _____ days if anyone was injured or killed, or property damage was over $1,000.",
      correctAnswer: "10",
      acceptableAnswers: ["ten"],
      explanation: "File form SR-1 with the DMV within 10 days — even if the crash wasn't your fault and police came to the scene.",
      similarQuestion: {
        prompt: "You're in a minor crash and someone says their neck hurts. What should you do first?",
        options: [
          "Drive away — it was only a fender-bender",
          "Stop, call 911, and stay at the scene",
          "Exchange phone numbers and leave",
          "Wait until tomorrow to report it",
        ],
        correctAnswer: "Stop, call 911, and stay at the scene",
        explanation: "When anyone is hurt you must stop, help, and get emergency services there. Leaving is a hit-and-run.",
      },
      harderQuestion: {
        prompt: "A crash causes about $1,500 of damage and no injuries. Which statement is correct?",
        options: [
          "No report is needed because no one was hurt",
          "An SR-1 must be filed with the DMV within 10 days",
          "Only your insurance company needs to know",
          "You must file a report within 24 hours or lose your license immediately",
        ],
        correctAnswer: "An SR-1 must be filed with the DMV within 10 days",
        explanation: "Damage over $1,000 triggers the SR-1 requirement on its own — injuries aren't required.",
      },
    },
  },
  {
    id: "lesson-03",
    topicId: "emergency-kit",
    category: "safety",
    title: "Your Vehicle Emergency Kit",
    driveFileId: "17a4v4kzNoaArZu8nYaj2dtuyh8arSfTe",
    videoUrl: drive("17a4v4kzNoaArZu8nYaj2dtuyh8arSfTe"),
    videoTitle: "Build a California-Ready Vehicle Emergency Kit",
    videoDescription:
      "Build a basic kit with a flashlight and extra batteries, jumper cables, and a first-aid kit. Roadside safety also means pulling over safely, using flashers, and waiting in the vehicle for help.",
    caHandbookRef: "California Driver's Handbook — Vehicle Breakdowns",
    handbookSummary:
      "Get as far off the road as possible, turn on your hazard flashers, and call for help. On a freeway, staying buckled inside is usually safer than standing near traffic.",
    impactReason: "People standing beside disabled cars are among the most exposed road users on a freeway shoulder.",
    safetyWeight: 0.75,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-03",
      type: "multiple_choice",
      prompt: "Your car breaks down on the freeway. You've coasted onto the shoulder and turned on your flashers. What's usually safest next?",
      options: [
        "Stand behind the car to wave traffic around it",
        "Stay inside with your seat belt on and call for help",
        "Walk along the freeway to the next exit",
        "Push the car back into the lane to restart it",
      ],
      correctAnswer: "Stay inside with your seat belt on and call for help",
      explanation:
        "Live freeway shoulders are dangerous. Unless the car is unsafe to stay in, remain buckled inside and call for help.",
      similarQuestion: {
        prompt: "Which item matters most to keep in your car's emergency kit?",
        options: ["A flashlight with extra batteries", "A spare phone case", "Extra floor mats", "A car air freshener"],
        correctAnswer: "A flashlight with extra batteries",
        explanation: "A flashlight lets you be seen and see at night. Jumper cables and a first-aid kit round out a basic kit.",
      },
      harderQuestion: {
        prompt: "Your engine dies in a moving freeway lane. What should you try to do first?",
        options: [
          "Stop immediately where you are",
          "Signal and coast onto the right shoulder or an off-ramp if possible",
          "Get out and push the car",
          "Turn the steering wheel hard to the left",
        ],
        correctAnswer: "Signal and coast onto the right shoulder or an off-ramp if possible",
        explanation: "Use your momentum to get completely out of the travel lanes before you stop.",
      },
    },
  },
  {
    id: "lesson-04",
    topicId: "curb-stops",
    category: "rules",
    title: "Stopping at Curbs & Curb Colors",
    driveFileId: "1vtHlAMD2nLjYv4DaqyRBIsvP5TZbmXk9",
    videoUrl: drive("1vtHlAMD2nLjYv4DaqyRBIsvP5TZbmXk9"),
    videoTitle: "Stopping Safely Before a Front Curb: Use Your Own Visual Reference",
    videoDescription:
      "Pull slowly toward a front curb without contact. A side-mirror reference helps, but it doesn't replace checking for people, observing curb restrictions, and leaving a safe gap.",
    caHandbookRef: "California Driver's Handbook — Parking: Painted Curbs; CVC §21458",
    handbookSummary:
      "Red: no stopping or parking. Yellow: load/unload only. White: brief passenger or mail pickup. Green: limited-time parking. Blue: disabled placard or plate only.",
    impactReason: "Curb-color questions are permit-test staples, and slow, controlled stops protect pedestrians near curbs.",
    safetyWeight: 0.55,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-04",
      type: "multiple_choice",
      prompt: "You're about to pull up to a curb painted red. What does it mean?",
      options: [
        "No stopping, standing, or parking",
        "Park for a limited time",
        "Stop only to pick up or drop off passengers",
        "Parking for people with disabilities only",
      ],
      correctAnswer: "No stopping, standing, or parking",
      explanation: "A red curb means no stopping, standing, or parking (buses may stop at red bus zones).",
      similarQuestion: {
        prompt: "A green-painted curb means:",
        options: [
          "Park for a limited time, as posted",
          "No parking at any time",
          "Disabled parking only",
          "Loading of freight only",
        ],
        correctAnswer: "Park for a limited time, as posted",
        explanation: "Green means limited-time parking — check the sign or curb paint for the time limit.",
      },
      harderQuestion: {
        prompt: "At a white curb you may:",
        options: [
          "Stop only long enough to pick up or drop off passengers or mail",
          "Park all day",
          "Load and unload freight for up to an hour",
          "Never stop for any reason",
        ],
        correctAnswer: "Stop only long enough to pick up or drop off passengers or mail",
        explanation: "White is for quick passenger or mail stops. Yellow is the loading zone color.",
      },
    },
  },
  {
    id: "lesson-05",
    topicId: "dark-signal",
    category: "rules",
    title: "When the Traffic Light Is Out",
    driveFileId: "1_ojGCh9jcQx18EYJ6fNHO-XHnROnMBBC",
    videoUrl: drive("1_ojGCh9jcQx18EYJ6fNHO-XHnROnMBBC"),
    videoTitle: "California: What to Do at a Nonworking Traffic Light",
    videoDescription:
      "A dark traffic light is not a free pass. Stop as though every approach has a STOP sign, establish who arrived first, yield when required, and enter only when the intersection is clear.",
    caHandbookRef: "California Driver's Handbook — Traffic Signals; CVC §21800(d)",
    handbookSummary: "A nonworking signal is treated as an all-way STOP. Stop, then follow normal right-of-way rules.",
    impactReason: "Power outages create confused, high-speed intersections where broadside crashes happen.",
    safetyWeight: 0.9,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-05",
      type: "multiple_choice",
      prompt: "You approach an intersection where the traffic lights are completely dark. What should you do?",
      options: [
        "Keep going — no light means no signal to obey",
        "Stop as if there were a STOP sign in every direction, then go when it's safe",
        "Slow down and honk while you cross",
        "Follow the car in front of you through without stopping",
      ],
      correctAnswer: "Stop as if there were a STOP sign in every direction, then go when it's safe",
      explanation: "A dark signal works like an all-way STOP: stop completely, then take turns using right-of-way rules.",
      similarQuestion: {
        prompt: "At a dark signal, you and another car stop at the same time. The other car is on your right. Who goes first?",
        options: ["The car on your right", "You do", "Whoever is driving the larger vehicle", "Whoever honks first"],
        correctAnswer: "The car on your right",
        explanation: "Same as an all-way stop: when you arrive together, yield to the vehicle on your right.",
      },
      harderQuestion: {
        prompt: "A traffic signal is flashing red instead of cycling normally. You should:",
        options: [
          "Treat it like a STOP sign",
          "Treat it like a yield sign and slow down",
          "Proceed with caution without stopping",
          "Wait for it to turn green",
        ],
        correctAnswer: "Treat it like a STOP sign",
        explanation: "A flashing red signal means stop completely, then proceed when it is safe.",
      },
    },
  },
  {
    id: "lesson-06",
    topicId: "emergency-vehicles",
    category: "safety",
    title: "Yielding to Approaching Emergency Vehicles",
    driveFileId: "1GChnmVU0NZ0JCmarHeWC8ELbY6mS-4eb",
    videoUrl: drive("1GChnmVU0NZ0JCmarHeWC8ELbY6mS-4eb"),
    videoTitle: "California: Pull Right and Stop for Approaching Emergency Vehicles",
    videoDescription:
      "When an emergency vehicle uses a siren and red lights, yield, pull to the right edge, and stop until it passes. If already in an intersection, clear it first.",
    caHandbookRef: "California Driver's Handbook — Emergency Vehicles; CVC §21806",
    handbookSummary:
      "Yield to emergency vehicles displaying flashing red lights and siren by safely pulling to the right edge and stopping.",
    impactReason: "Clears urgent pathways for emergency crews and prevents high-speed intersection collisions.",
    safetyWeight: 0.95,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-06",
      type: "multiple_choice",
      prompt: "You are already inside an intersection when an ambulance approaches with siren and red lights. What should you do?",
      options: [
        "Stop immediately right where you are in the intersection",
        "Drive completely through the intersection, then safely pull to the right edge and stop",
        "Make a sharp left U-turn",
        "Speed up and stay ahead of the ambulance",
      ],
      correctAnswer: "Drive completely through the intersection, then safely pull to the right edge and stop",
      explanation: "Never stop in the middle of an intersection; clear the junction first, then move right and stop.",
      similarQuestion: {
        prompt: "A fire truck with siren and red lights comes up behind you on a city street. You should:",
        options: [
          "Pull to the right edge of the road and stop",
          "Stop in your lane right away",
          "Speed up to stay ahead of it",
          "Move to the left lane",
        ],
        correctAnswer: "Pull to the right edge of the road and stop",
        explanation: "Yield by moving to the right edge and stopping until the emergency vehicle has passed.",
      },
      harderQuestion: {
        prompt: "After an ambulance passes you, what is the legal following distance behind a firetruck or ambulance responding to an emergency?",
        options: ["300 feet", "50 feet", "100 feet", "There is no rule"],
        correctAnswer: "300 feet",
        explanation: "Do not follow within 300 feet of a firetruck or emergency vehicle that is responding to an alarm.",
      },
    },
  },
  {
    id: "lesson-07",
    topicId: "emergency-right-edge",
    category: "safety",
    title: "Which Way Do You Pull Over?",
    driveFileId: "1r9khG6O7RDiWolVVTUjB-ef591tlXiI3",
    videoUrl: drive("1r9khG6O7RDiWolVVTUjB-ef591tlXiI3"),
    videoTitle: "Emergency Vehicles: California's Right-Edge Yield Rule",
    videoDescription:
      "This clip demonstrates yielding to an approaching emergency vehicle. The core idea transfers, but the road-side position must be localized for California.",
    localizationNote:
      "Heads up: the pull-over side shown in this clip doesn't match California. Here, always move to the RIGHT edge of the road and stop.",
    caHandbookRef: "California Driver's Handbook — Emergency Vehicles; CVC §21806",
    handbookSummary: "In California, yield to emergency vehicles by moving to the right edge of the road and stopping until they pass.",
    impactReason: "Hesitating or moving the wrong way blocks the lane crews need and can cause a collision.",
    safetyWeight: 0.95,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-07",
      type: "qte",
      prompt: "Quick Reaction: A siren and flashing red lights are coming up fast behind you on a two-lane road.",
      correctAnswer: "PULL_RIGHT",
      explanation: "California rule: move to the right edge of the road and stop until the emergency vehicle passes.",
      qteConfig: {
        scenario: "Two-lane road — emergency vehicle closing from behind with siren on.",
        targetAction: "PULL_RIGHT",
        timeLimitSeconds: 5,
        hazardDescription: "Ambulance approaching from behind with red lights and siren.",
        visual: "siren",
        actions: [
          { id: "PULL_RIGHT", label: "Pull to the right edge & stop" },
          { id: "PULL_LEFT", label: "Pull to the left edge" },
          { id: "STOP_IN_LANE", label: "Stop right in your lane" },
          { id: "SPEED_UP", label: "Speed up to clear the way" },
        ],
      },
      similarQuestion: {
        prompt: "On a California road, which side do you pull to for an approaching emergency vehicle?",
        options: ["The right edge", "The left edge", "Whichever side is closer", "Neither — keep driving"],
        correctAnswer: "The right edge",
        explanation: "Always the right edge in California, then stop until it passes.",
      },
      harderQuestion: {
        prompt: "You're on a one-way street in the far-left lane when you hear a siren behind you. What should you do?",
        options: [
          "Safely move to the right edge and stop",
          "Stay in the left lane and stop",
          "Speed up to reach the next intersection",
          "Turn on your hazards and keep driving",
        ],
        correctAnswer: "Safely move to the right edge and stop",
        explanation: "The California rule is the right edge — signal, check, and move over when it is safe.",
      },
    },
  },
  {
    id: "lesson-08",
    topicId: "intersection-right-of-way",
    category: "rules",
    title: "Uncontrolled Intersections & Right-of-Way",
    driveFileId: "1CTBD4PdYsM_EKDFtWYUYaiIrBAYP9Wat",
    videoUrl: drive("1CTBD4PdYsM_EKDFtWYUYaiIrBAYP9Wat"),
    videoTitle: "California Right-of-Way: Who Goes First at Intersections?",
    videoDescription:
      "At an uncontrolled intersection, the road user who arrives first normally goes first; if arrival is simultaneous, yield to the road user on your right.",
    caHandbookRef: "California Driver's Handbook — Right-of-Way Rules: Intersections; CVC §21800",
    handbookSummary:
      "The vehicle arriving first goes first. When two vehicles arrive at the same time, yield to the vehicle or bicyclist on your right.",
    impactReason: "Eliminates hesitation and right-angle broadside crashes at neighborhood intersections.",
    safetyWeight: 0.9,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-08",
      type: "qte",
      prompt: "Quick Reaction: You reach an uncontrolled 4-way intersection simultaneously with a cyclist approaching from your right.",
      correctAnswer: "YIELD_RIGHT",
      explanation: "When arriving simultaneously at uncontrolled intersections, you must yield to road users on your right.",
      qteConfig: {
        scenario: "Intersection approach — vehicle on left, cyclist on right arriving simultaneously.",
        targetAction: "YIELD_RIGHT",
        timeLimitSeconds: 4,
        hazardDescription: "Cyclist entering cross street on the right side.",
        visual: "intersection",
        actions: [
          { id: "YIELD_RIGHT", label: "Yield to the cyclist on your right" },
          { id: "GO_FIRST", label: "Go first — you're the bigger vehicle" },
          { id: "WAVE_LEFT", label: "Wave the car on your left through" },
          { id: "SPEED_UP", label: "Speed up through the intersection" },
        ],
      },
      similarQuestion: {
        prompt: "At an uncontrolled intersection, you arrived first. Another car arrives a moment later on your right. Who goes?",
        options: ["You — you arrived first", "The car on your right", "Whoever is going straight", "The larger vehicle"],
        correctAnswer: "You — you arrived first",
        explanation: "First to arrive goes first. 'Yield to the right' is the tie-breaker for simultaneous arrivals.",
      },
      harderQuestion: {
        prompt: "At a T-intersection with no signs, you are on the road that ends. Who has the right-of-way?",
        options: [
          "Vehicles on the through road",
          "You, because you are turning",
          "Whoever is on the right",
          "Whoever arrived last",
        ],
        correctAnswer: "Vehicles on the through road",
        explanation: "At a T-intersection without signs, vehicles and riders on the through road have the right-of-way.",
      },
    },
  },
  {
    id: "lesson-09",
    topicId: "headlight-choices",
    category: "weather",
    title: "High Beams, Low Beams, Rain & Fog",
    driveFileId: "1LU0sGCARs-RekbvJaS58KP3M2icwAec6",
    videoUrl: drive("1LU0sGCARs-RekbvJaS58KP3M2icwAec6"),
    videoTitle: "California High-Beam Choices: Dark Roads, Rain, and Fog",
    videoDescription:
      "Use high beams when they improve visibility without blinding others. In rain, fog, or heavy smoke, use low beams and slow to a speed that lets you stop within what you can see.",
    caHandbookRef: "California Driver's Handbook — Headlights; CVC §24409, §24400",
    handbookSummary:
      "Dim to low beams within 500 feet of an oncoming vehicle or 300 feet of one you're following. Use low beams in fog, rain, and smoke.",
    impactReason: "Glare and over-driving your headlights are major factors in night and bad-weather crashes.",
    safetyWeight: 0.75,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-09",
      type: "multiple_choice",
      prompt: "You're driving at night in thick fog. Which headlights should you use?",
      options: ["Low beams", "High beams", "Parking lights only", "No lights, to avoid glare"],
      correctAnswer: "Low beams",
      explanation: "High beams reflect off fog and blind you. Use low beams and slow down.",
      similarQuestion: {
        prompt: "When must you switch from high beams to low beams?",
        options: [
          "Within 500 feet of an oncoming vehicle",
          "Only on freeways",
          "Only when it is raining",
          "Never — high beams are always safest",
        ],
        correctAnswer: "Within 500 feet of an oncoming vehicle",
        explanation: "Dim within 500 feet of oncoming traffic and within 300 feet of a vehicle you're following.",
      },
      harderQuestion: {
        type: "fill_blank",
        prompt: "You must dim your high beams when you are within _____ feet of a vehicle you are following.",
        correctAnswer: "300",
        acceptableAnswers: ["three hundred"],
        explanation: "300 feet when following, 500 feet for oncoming traffic.",
      },
    },
  },
  {
    id: "lesson-10",
    topicId: "passing-bicyclists",
    category: "awareness",
    title: "3-Foot Minimum Clearance for Bicycles",
    driveFileId: "1sZqOB7a4kZBqFtBoIgW3sjHSTWxrEbU9",
    videoUrl: drive("1sZqOB7a4kZBqFtBoIgW3sjHSTWxrEbU9"),
    videoTitle: "Passing a Bicyclist Safely in California: Give 3 Feet",
    videoDescription:
      "Wait for a safe passing opportunity, leave at least three feet of clearance, and return only after you are safely past. If three feet is unavailable, stay behind and wait.",
    caHandbookRef: "California Driver's Handbook — Sharing the Road: Bicyclists; CVC §21760",
    handbookSummary:
      "California law mandates leaving at least 3 feet of clearance when passing a bicyclist. If unable to give 3 feet, slow down and wait.",
    impactReason: "Protects vulnerable road users on narrow roads and prevents fatal side-swipe collisions.",
    safetyWeight: 0.9,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-10",
      type: "fill_blank",
      prompt: "In California, drivers must give bicyclists at least _____ feet of clearance when passing.",
      correctAnswer: "3",
      acceptableAnswers: ["three"],
      explanation: "California's Three Feet for Safety Act requires at least 3 feet of cushion when overtaking cyclists.",
      similarQuestion: {
        prompt: "You can't give a cyclist 3 feet because of oncoming traffic. What should you do?",
        options: [
          "Slow down and wait behind until it's safe to pass",
          "Pass anyway, but quickly",
          "Honk so the cyclist moves over",
          "Pass using the bike lane",
        ],
        correctAnswer: "Slow down and wait behind until it's safe to pass",
        explanation: "If 3 feet isn't available, the law says slow down and wait until you can pass safely.",
      },
      harderQuestion: {
        prompt: "When is it OK to return to your lane after passing a cyclist?",
        options: [
          "Once you can see the cyclist in your rear-view mirror with room to spare",
          "As soon as your front bumper is past them",
          "Right after you signal",
          "Whenever the cyclist waves you over",
        ],
        correctAnswer: "Once you can see the cyclist in your rear-view mirror with room to spare",
        explanation: "Return only when you're safely past — cutting back early can clip the rider.",
      },
    },
  },
  {
    id: "lesson-11",
    topicId: "freeway-entry",
    category: "freeway",
    title: "Entering the Freeway",
    driveFileId: "1DWqoKoFV49U8JV9_UtOL6fmfEW8j2uNW",
    videoUrl: drive("1DWqoKoFV49U8JV9_UtOL6fmfEW8j2uNW"),
    videoTitle: "Entering a California Freeway Safely: Match Speed, Signal, Scan, Merge",
    videoDescription:
      "Use the on-ramp to approach highway speed, signal, check mirrors and blind spots, yield to freeway traffic, and enter only when a gap is large enough.",
    caHandbookRef: "California Driver's Handbook — Merging In and Out of Traffic",
    handbookSummary:
      "Enter the freeway at or near the speed of traffic. Don't stop on the ramp unless absolutely necessary, and merge into a gap that's big enough.",
    impactReason: "Entering too slowly forces freeway traffic to brake hard and causes rear-end and sideswipe crashes.",
    safetyWeight: 0.85,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-11",
      type: "multiple_choice",
      prompt: "When entering a freeway from an on-ramp, you should:",
      options: [
        "Use the ramp to reach about the speed of freeway traffic, signal, check, and merge into a safe gap",
        "Stop at the end of the ramp and wait for a big opening",
        "Enter slowly so freeway drivers notice you",
        "Expect freeway traffic to move over for you",
      ],
      correctAnswer: "Use the ramp to reach about the speed of freeway traffic, signal, check, and merge into a safe gap",
      explanation: "Matching speed makes your merge predictable. Stopping on the ramp makes it far harder to merge safely.",
      similarQuestion: {
        prompt: "What speed should you be going as you merge onto the freeway?",
        options: [
          "At or near the speed of freeway traffic",
          "About 20 mph below traffic, to be careful",
          "Faster than everyone, to get ahead",
          "Whatever the ramp's curve sign says",
        ],
        correctAnswer: "At or near the speed of freeway traffic",
        explanation: "Merge at or near the flow of traffic so drivers don't have to brake around you.",
      },
      harderQuestion: {
        prompt: "How many seconds of space should you look for when merging into freeway traffic?",
        options: ["About 4 seconds", "About 1 second", "Any space bigger than one car length", "No gap — traffic will make room"],
        correctAnswer: "About 4 seconds",
        explanation: "You need a gap of about 4 seconds so you have a safe cushion on both sides once you merge.",
      },
    },
  },
  {
    id: "lesson-12",
    topicId: "freeway-merge-yield",
    category: "freeway",
    title: "Merging Means Yielding",
    driveFileId: "1ZFGrv7R9IAOQxHvJEMm6w_aspjO1DFaM",
    videoUrl: drive("1ZFGrv7R9IAOQxHvJEMm6w_aspjO1DFaM"),
    videoTitle: "California Freeway Merging: Match Speed, Check, Signal, and Yield",
    videoDescription:
      "A safe freeway merge uses the on-ramp, a sufficiently large gap, a signal, mirror and shoulder checks, and a yield to highway traffic.",
    caHandbookRef: "California Driver's Handbook — Merging In and Out of Traffic; CVC §22107",
    handbookSummary: "Traffic already on the freeway has the right-of-way. Signal, check your mirror and blind spot, and fit into a gap.",
    impactReason: "Most merge crashes happen when the entering driver assumes the gap will be made for them.",
    safetyWeight: 0.85,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-12",
      type: "multiple_choice",
      prompt: "Who has the right-of-way when you merge onto a freeway?",
      options: [
        "Traffic already on the freeway",
        "You, because you're entering",
        "Whoever is going faster",
        "Whoever signals first",
      ],
      correctAnswer: "Traffic already on the freeway",
      explanation: "Merging drivers yield. Adjust your speed on the ramp to fit into a gap.",
      similarQuestion: {
        prompt: "Right before you merge, what's the last check you make?",
        options: [
          "A quick look over your shoulder at your blind spot",
          "Your speedometer",
          "Your phone's navigation",
          "The car behind you on the ramp",
        ],
        correctAnswer: "A quick look over your shoulder at your blind spot",
        explanation: "Mirrors don't show everything. A shoulder check catches a car sitting in your blind spot.",
      },
      harderQuestion: {
        prompt: "Halfway down the ramp, the freeway lane beside you is packed with no gap. What's the best move?",
        options: [
          "Adjust your speed early to line up with a gap that's opening",
          "Floor it and squeeze in",
          "Drive onto the shoulder and pass the line of cars",
          "Stop at the end of the ramp no matter what",
        ],
        correctAnswer: "Adjust your speed early to line up with a gap that's opening",
        explanation: "Plan early: use the ramp to speed up or ease off to match a gap. Stop only as a last resort.",
      },
    },
  },
  {
    id: "lesson-13",
    topicId: "drive-test-habits",
    category: "awareness",
    title: "Drive-Test Habits: Scan, Space, Signal",
    driveFileId: "1QNLB1SbsLqwCnO8ho4iDzE9IMMTIYwvC",
    videoUrl: drive("1QNLB1SbsLqwCnO8ho4iDzE9IMMTIYwvC"),
    videoTitle: "California Drive-Test Readiness: Scan, Space, and Core Maneuvers",
    videoDescription:
      "Prepare for the drive test by scanning continuously, maintaining space, signaling early, checking blind spots, and practicing controlled turns, stops, and lane changes.",
    caHandbookRef: "California Driver's Handbook — Driving Test; Changing Lanes",
    handbookSummary: "Before every lane change: signal, check mirrors, look over your shoulder, then move smoothly when it's clear.",
    impactReason: "These habits are what examiners score — and what keeps new drivers out of lane-change crashes.",
    safetyWeight: 0.6,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-13",
      type: "multiple_choice",
      prompt: "Which routine should you use before every lane change?",
      options: [
        "Signal, check mirrors, look over your shoulder, then move when clear",
        "Check the rear-view mirror only",
        "Move first, then signal",
        "Honk, then change lanes",
      ],
      correctAnswer: "Signal, check mirrors, look over your shoulder, then move when clear",
      explanation: "Signal → mirrors → shoulder → move. The examiner watches for every step.",
      similarQuestion: {
        prompt: "How far ahead should you signal before a turn?",
        options: ["At least 100 feet", "5 feet", "Only when other cars are around", "After you start turning"],
        correctAnswer: "At least 100 feet",
        explanation: "Signal at least 100 feet before you turn so others can plan around you.",
      },
      harderQuestion: {
        prompt: "When you come to a stop behind another car, you should be able to see:",
        options: [
          "Its rear tires touching the pavement",
          "Only its roof",
          "Its license plate filling your windshield",
          "Nothing — get as close as possible",
        ],
        correctAnswer: "Its rear tires touching the pavement",
        explanation: "Seeing the rear tires leaves room to steer around the car if it stalls or you're hit from behind.",
      },
    },
  },
  {
    id: "lesson-14",
    topicId: "blind-spot-check",
    category: "awareness",
    title: "Blind-Spot Checks: Look Over Your Shoulder",
    driveFileId: "1p2HcBOYZkz98xnSTu2U2n4MA-Vm3ORr0",
    videoUrl: drive("1p2HcBOYZkz98xnSTu2U2n4MA-Vm3ORr0"),
    videoTitle: "California Blind-Spot Checks: Look Over Both Shoulders",
    videoDescription:
      "Before changing lanes, use mirrors and make a quick shoulder check. Looking over the relevant shoulder helps identify vehicles, motorcycles, bicycles, and other road users hidden from mirrors.",
    caHandbookRef: "California Driver's Handbook — Blind Spots; Changing Lanes",
    handbookSummary: "Mirrors leave blind spots. Always turn your head and look over your shoulder before changing lanes.",
    impactReason: "Motorcycles and bikes vanish in blind spots — the shoulder check is what finds them.",
    safetyWeight: 0.9,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-14",
      type: "qte",
      prompt: "Quick Reaction: You've signaled to move left. Your mirror looks clear, but traffic is heavy.",
      correctAnswer: "MIRROR_CHECK",
      explanation: "A mirror can't see your blind spot. A quick look over your shoulder catches what it misses.",
      qteConfig: {
        scenario: "Multi-lane road — you're about to change lanes left.",
        targetAction: "MIRROR_CHECK",
        timeLimitSeconds: 4,
        hazardDescription: "Motorcycle riding in your left blind spot.",
        visual: "lane-change",
        actions: [
          { id: "MIRROR_CHECK", label: "Mirror + shoulder check first" },
          { id: "CHANGE_NOW", label: "Mirror's clear — move over now" },
          { id: "SPEED_UP", label: "Speed up and cut over" },
          { id: "BRAKE_HARD", label: "Brake hard, then move" },
        ],
      },
      similarQuestion: {
        prompt: "Why do you look over your shoulder before changing lanes?",
        options: [
          "To see vehicles hidden in your blind spot",
          "To check your hair",
          "Because the mirrors are always wrong",
          "It's only needed on the drive test",
        ],
        correctAnswer: "To see vehicles hidden in your blind spot",
        explanation: "Blind spots can hide a whole car — and easily a motorcycle or bike.",
      },
      harderQuestion: {
        prompt: "You're driving next to a large truck on the freeway. What's the safest choice?",
        options: [
          "Don't linger in its blind spots — pass or drop back",
          "Stay right beside its cab",
          "Follow closely to cut wind resistance",
          "Pass on the right whenever possible",
        ],
        correctAnswer: "Don't linger in its blind spots — pass or drop back",
        explanation: "Trucks have large blind spots on both sides. If you can't see the driver in their mirror, they can't see you.",
      },
    },
  },
  {
    id: "lesson-15",
    topicId: "blind-curves",
    category: "awareness",
    title: "Blind Curves & Parked Cars",
    driveFileId: "11KHpDOBdM0xceEYzsBiRf4x5jcse0AwC",
    videoUrl: drive("11KHpDOBdM0xceEYzsBiRf4x5jcse0AwC"),
    videoTitle: "Slow Down for Blind Curves and Parked Cars: California Driving",
    videoDescription:
      "Blind curves and parked cars can hide pedestrians, bicyclists, and oncoming vehicles. Reduce speed and keep a path that allows time to react.",
    caHandbookRef: "California Driver's Handbook — Scanning; Basic Speed Law (CVC §22350)",
    handbookSummary: "Where you can't see far ahead, slow down so you can stop for anything that appears.",
    impactReason: "Children stepping out between parked cars is a classic residential-street crash.",
    safetyWeight: 0.85,
    requiresKnowledgeCheck: true,
    quiz: {
      id: "q-15",
      type: "qte",
      prompt: "Quick Reaction: Narrow street, blind curve ahead, a row of parked cars on your right — a ball bounces into the road.",
      correctAnswer: "SLOW_DOWN",
      explanation: "A ball often means a child is close behind. Slow down and cover the brake.",
      qteConfig: {
        scenario: "Residential street with parked cars and a blind curve.",
        targetAction: "SLOW_DOWN",
        timeLimitSeconds: 4,
        hazardDescription: "A ball rolls out from between parked cars.",
        visual: "blind-curve",
        actions: [
          { id: "SLOW_DOWN", label: "Slow down & cover the brake" },
          { id: "HONK", label: "Honk and keep going" },
          { id: "SWERVE", label: "Swerve into the oncoming lane" },
          { id: "SPEED_UP", label: "Speed past before anyone appears" },
        ],
      },
      similarQuestion: {
        prompt: "You're passing a long row of parked cars. What should you watch for?",
        options: [
          "People or bikes stepping out and doors opening",
          "Nothing — parked cars don't move",
          "Only the car directly ahead",
          "Your phone's map",
        ],
        correctAnswer: "People or bikes stepping out and doors opening",
        explanation: "Parked cars hide pedestrians, and doors can swing open into your path.",
      },
      harderQuestion: {
        prompt: "Approaching a blind curve on a two-lane road, where should you position your car?",
        options: [
          "Keep to the right in your lane and slow down",
          "Hug the center line for a better view",
          "Drift into the oncoming lane to straighten the curve",
          "Speed up to get through the curve quickly",
        ],
        correctAnswer: "Keep to the right in your lane and slow down",
        explanation: "Oncoming drivers may cut the curve. Staying right and slowing gives you room to react.",
      },
    },
  },
  {
    id: "lesson-16",
    topicId: "basic-speed-law",
    category: "weather",
    title: "Poor Visibility & the Basic Speed Law",
    driveFileId: "1XNKlZdkoMgTuy2IIuBW7w4hkboV32e1_",
    videoUrl: drive("1XNKlZdkoMgTuy2IIuBW7w4hkboV32e1_"),
    videoTitle: "Blind Bends and Parked Cars: California Poor-Visibility Driving",
    videoDescription:
      "When visibility is limited by a bend, parked cars, rain, fog, darkness, or glare, slow down and expect hidden road users or vehicles.",
    caHandbookRef: "California Driver's Handbook — Basic Speed Law; CVC §22350",
    handbookSummary:
      "Never drive faster than is safe for current conditions — even if that's below the posted limit.",
    impactReason: "'Too fast for conditions' is one of the most common factors in teen crashes.",
    safetyWeight: 0.8,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-16",
      type: "multiple_choice",
      prompt: "California's Basic Speed Law means:",
      options: [
        "Never drive faster than is safe for current conditions, even below the posted limit",
        "You may always drive the posted speed limit",
        "You can drive 5 mph over the limit in good weather",
        "Speed limits only apply in daylight",
      ],
      correctAnswer: "Never drive faster than is safe for current conditions, even below the posted limit",
      explanation: "The posted limit is a maximum for ideal conditions. Rain, fog, glare, or traffic can make it unsafe.",
      similarQuestion: {
        prompt: "The limit is 55 mph, but heavy fog lets you see only a short distance. What's a safe speed?",
        options: [
          "Slow enough to stop within the distance you can see",
          "55 mph — that's the limit",
          "45 mph, always",
          "Keep up with whoever is ahead of you",
        ],
        correctAnswer: "Slow enough to stop within the distance you can see",
        explanation: "Drive so you can stop within the space you can see ahead.",
      },
      harderQuestion: {
        prompt: "Roads are often most slippery when:",
        options: [
          "It first starts to rain after a dry spell",
          "It has rained steadily for several hours",
          "The sun comes out after rain",
          "It is cold but dry",
        ],
        correctAnswer: "It first starts to rain after a dry spell",
        explanation: "Oil and dust mix with the first rain to make a slick film. Slow down early.",
      },
    },
  },
  {
    id: "lesson-17",
    topicId: "large-vehicle-merge",
    category: "freeway",
    title: "Making Space for Trucks & Trailers",
    driveFileId: "1ADJV7ovhIvX-J5B7OjU2A25zXZLOf3dn",
    videoUrl: drive("1ADJV7ovhIvX-J5B7OjU2A25zXZLOf3dn"),
    videoTitle: "Making Space for a Trailer-Towing Vehicle Merging on a Freeway",
    videoDescription:
      "Large and trailer-towing vehicles need more time and room to accelerate, merge, and change lanes. Scan early and create space without abrupt braking.",
    caHandbookRef: "California Driver's Handbook — Sharing the Road: Large Trucks",
    handbookSummary: "Big vehicles accelerate slowly and need extra room. Make space early and smoothly — never cut in front of them.",
    impactReason: "Crashes with large vehicles are far more likely to be severe for the smaller car.",
    safetyWeight: 0.75,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-17",
      type: "multiple_choice",
      prompt: "A pickup towing a trailer is merging onto the freeway just ahead of you. What's the safest response?",
      options: [
        "If it's safe, change lanes left or ease off early to give it room",
        "Speed up so it has to merge behind you",
        "Brake hard right next to the ramp",
        "Honk so the driver knows you're there",
      ],
      correctAnswer: "If it's safe, change lanes left or ease off early to give it room",
      explanation: "Scan ahead, then make space smoothly. Sudden braking can cause a rear-end crash behind you.",
      similarQuestion: {
        prompt: "Why do trucks and trailers need extra space to merge?",
        options: [
          "They accelerate and stop more slowly",
          "They always have the right-of-way",
          "They are allowed to use the shoulder",
          "They don't, they're the same as cars",
        ],
        correctAnswer: "They accelerate and stop more slowly",
        explanation: "More weight means slower acceleration and longer stopping distances.",
      },
      harderQuestion: {
        prompt: "After passing a large truck, when is it safe to move back in front of it?",
        options: [
          "When you can see the whole front of the truck in your rear-view mirror",
          "As soon as your back bumper clears its front bumper",
          "Right after you signal",
          "Whenever the truck flashes its lights",
        ],
        correctAnswer: "When you can see the whole front of the truck in your rear-view mirror",
        explanation: "Cutting in too soon takes away the long stopping distance a truck needs.",
      },
    },
  },
  {
    id: "lesson-18",
    topicId: "stopping-distance",
    category: "safety",
    title: "More Speed, More Stopping Space",
    driveFileId: "1WSi59pfl7X-plZlmYpIu18sBb1UGf0u2",
    videoUrl: drive("1WSi59pfl7X-plZlmYpIu18sBb1UGf0u2"),
    videoTitle: "Why More Speed Requires More Stopping Space",
    videoDescription:
      "Stopping distance grows as speed, reaction time, road conditions, and vehicle condition change. Leave more space whenever risk or visibility increases.",
    caHandbookRef: "California Driver's Handbook — Space to Stop; Speed Limits",
    handbookSummary: "Stopping distance = reaction distance + braking distance, and braking distance grows much faster than speed.",
    impactReason: "Underestimating stopping distance is behind most rear-end and pedestrian crashes at speed.",
    safetyWeight: 0.8,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-18",
      type: "multiple_choice",
      prompt: "If you double your speed, your braking distance becomes about:",
      options: ["Four times as long", "Twice as long", "The same", "Half as long"],
      correctAnswer: "Four times as long",
      explanation: "Braking distance grows with the square of speed — double the speed, about four times the distance.",
      similarQuestion: {
        prompt: "Which of these makes your total stopping distance longer?",
        options: ["Wet roads and worn tires", "Dry pavement", "Driving slower", "Good brakes"],
        correctAnswer: "Wet roads and worn tires",
        explanation: "Poor traction and worn equipment add distance. Leave more room when conditions get worse.",
      },
      harderQuestion: {
        prompt: "Total stopping distance is made up of:",
        options: [
          "Perception and reaction distance plus braking distance",
          "Braking distance only",
          "The distance to the car ahead",
          "Your speed in mph divided by 10",
        ],
        correctAnswer: "Perception and reaction distance plus braking distance",
        explanation: "You travel a long way before you even touch the brake — that's why space matters.",
      },
    },
  },
  {
    id: "lesson-19",
    topicId: "following-distance",
    category: "safety",
    title: "The 3-Second Following Distance Rule",
    driveFileId: "1p9FHYRArlRncwtVcP1kun-xJ6Cmcfpxx",
    videoUrl: drive("1p9FHYRArlRncwtVcP1kun-xJ6Cmcfpxx"),
    videoTitle: "Use the California Three-Second Following-Distance Check",
    videoDescription:
      "Choose a fixed roadside object, wait for the vehicle ahead to pass it, and count until you reach the same point. Increase the gap in poor conditions or behind large vehicles.",
    caHandbookRef: "California Driver's Handbook — Following Distance; CVC §21703",
    handbookSummary:
      "Keep a minimum 3-second cushion under ideal conditions. Expand to 4+ seconds in rain, fog, darkness, or behind heavy trucks.",
    impactReason: "Directly combats rear-end collisions, the single most common teen driver crash type.",
    safetyWeight: 0.85,
    requiresKnowledgeCheck: false,
    quiz: {
      id: "q-19",
      type: "multiple_choice",
      prompt: "When should you increase your following distance beyond the basic 3-second rule?",
      options: [
        "Only when driving on an interstate",
        "During rain, slippery roads, night driving, or when following a large truck",
        "Never; 3 seconds is always sufficient",
        "Only when another vehicle is tailgating you",
      ],
      correctAnswer: "During rain, slippery roads, night driving, or when following a large truck",
      explanation: "Adverse weather and heavy vehicles require extended stopping margins.",
      similarQuestion: {
        type: "fill_blank",
        prompt: "In good conditions, keep at least a _____-second following distance.",
        correctAnswer: "3",
        acceptableAnswers: ["three"],
        explanation: "Count 'one-thousand-one, one-thousand-two, one-thousand-three' from a fixed object.",
      },
      harderQuestion: {
        prompt: "How do you measure a 3-second following distance?",
        options: [
          "When the car ahead passes a fixed object, count until you reach it",
          "Count car lengths between you and the car ahead",
          "Look at your speedometer and divide by 3",
          "Wait until the car ahead brakes",
        ],
        correctAnswer: "When the car ahead passes a fixed object, count until you reach it",
        explanation: "Pick a sign or pole. If you reach it before 'one-thousand-three', back off.",
      },
    },
  },
];

export function getLessonById(id: string): LessonItem | undefined {
  return LESSON_SEEDS.find((lesson) => lesson.id === id);
}

/** Case- and whitespace-insensitive answer check shared by client and server. */
export function isAnswerCorrect(
  question: { correctAnswer: string; acceptableAnswers?: string[] },
  answer: string,
): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.]$/, "");
  const given = normalize(answer);
  return [question.correctAnswer, ...(question.acceptableAnswers ?? [])].some((accepted) => normalize(accepted) === given);
}

export interface EmergencyChecklistItem {
  id: string;
  category: "collision" | "breakdown" | "traffic_stop" | "bad_weather";
  title: string;
  stepNumber: number;
  instruction: string;
  legalNote?: string;
}

export const EMERGENCY_CHECKLIST: EmergencyChecklistItem[] = [
  {
    id: "em-01",
    category: "collision",
    stepNumber: 1,
    title: "Check Safety & Move Off Roadway",
    instruction:
      "Stop. Check yourself and passengers for injuries. If no one is hurt and the vehicle is drivable, move out of active traffic lanes onto the shoulder.",
    legalNote: "You must stop after any collision (CVC §20001, §20002). Leaving the scene is a crime.",
  },
  {
    id: "em-02",
    category: "collision",
    stepNumber: 2,
    title: "Call 911 & Turn On Hazards",
    instruction:
      "Call 911 if anyone is hurt or the scene is dangerous. Turn on hazard flashers and, if it's safe, set up reflectors or flares behind the vehicle.",
    legalNote: "Helps oncoming motorists avoid a secondary collision.",
  },
  {
    id: "em-03",
    category: "collision",
    stepNumber: 3,
    title: "Exchange Required Information",
    instruction:
      "Exchange full name, address, driver's license number, vehicle registration, and auto insurance policy details.",
    legalNote: "Do not admit fault or argue on scene; document facts and photos safely.",
  },
  {
    id: "em-04",
    category: "collision",
    stepNumber: 4,
    title: "File Required Reports",
    instruction:
      "If anyone was injured or killed, or damage is over $1,000, file form SR-1 with the DMV within 10 days.",
    legalNote:
      "SR-1 is required by CVC §16000. Injury or fatal crashes must also be reported to CHP or local police within 24 hours (CVC §20008).",
  },
  {
    id: "em-05",
    category: "traffic_stop",
    stepNumber: 1,
    title: "Acknowledge Officer & Pull Right",
    instruction: "Signal immediately, slow down smoothly, and pull safely to the right shoulder or well-lit parking area.",
    legalNote: "Signals compliance and helps protect officer safety on active roadways.",
  },
  {
    id: "em-06",
    category: "traffic_stop",
    stepNumber: 2,
    title: "Keep Hands on Steering Wheel",
    instruction:
      "Turn off the engine, roll down the window, turn on the interior light at night, and keep both hands visible on the steering wheel.",
    legalNote: "Wait for the officer's instructions before reaching for license or registration.",
  },
  {
    id: "em-07",
    category: "traffic_stop",
    stepNumber: 3,
    title: "Provide Documents When Asked",
    instruction:
      "Tell the officer where your documents are before reaching for them. Stay calm and polite; if you disagree with a ticket, contest it in court — not on the roadside.",
    legalNote: "Drivers must show their license, registration, and proof of insurance on request (CVC §12951, §4462, §16028).",
  },
  {
    id: "em-08",
    category: "breakdown",
    stepNumber: 1,
    title: "Freeway Breakdown Protocol",
    instruction:
      "Signal and coast to the right shoulder or an off-ramp if possible. Turn on hazard flashers. Never stand directly behind your vehicle on a live freeway shoulder.",
    legalNote: "Stay inside with seatbelt fastened if shoulder is too narrow to safely exit.",
  },
  {
    id: "em-09",
    category: "breakdown",
    stepNumber: 2,
    title: "Call for Help",
    instruction:
      "Call 911 if you're in a dangerous spot, otherwise call roadside assistance. Share your freeway, direction, and nearest exit or call-box number.",
  },
  {
    id: "em-10",
    category: "bad_weather",
    stepNumber: 1,
    title: "Rain: Lights On, Speed Down",
    instruction:
      "Turn on headlights, slow down, and add following distance. If you hydroplane, ease off the gas, keep the wheel straight, and avoid hard braking.",
    legalNote: "Headlights are required whenever your wipers are on continuously (CVC §24400).",
  },
  {
    id: "em-11",
    category: "bad_weather",
    stepNumber: 2,
    title: "Fog or Smoke: Low Beams",
    instruction:
      "Use low beams — never high beams — and drive so you can stop within the distance you can see. If you can barely see, pull completely off the road and turn on your flashers.",
  },
];
