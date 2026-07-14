(function () {
  const base = window.DONAU_ASSET_BASE || "assets/donau/";
  const asset = (path) => `${base}${path}`;
  const developmentSupportConfig = {
    wellbeingSupportRoles: [
      "Parent or trusted adult",
      "Coach",
      "Club welfare contact",
      "Doctor",
      "Qualified mental-health professional",
    ],
    welfareContacts: [],
  };
  const developmentEvidenceLibrary = {
    "wr-conditioning-youth": {
      title: "Introduction to Conditioning for Young Players",
      organisation: "World Rugby",
      year: "2023",
      summary: "Supports age-appropriate physical preparation, movement quality, and gradual progression for adolescent players.",
      link: "https://passport.world.rugby/conditioning-for-rugby/introduction-to-conditioning/introduction-to-conditioning-for-young-players/",
    },
    "wr-conditioning-children": {
      title: "Introduction to Conditioning for Children",
      organisation: "World Rugby",
      year: "2023",
      summary: "Reinforces broad movement development, fun, and safe learning before narrow physical specialization.",
      link: "https://passport.world.rugby/conditioning-for-rugby/introduction-to-conditioning/introduction-to-conditioning-for-children/",
    },
    "wr-rugby-ready": {
      title: "Rugby Ready",
      organisation: "World Rugby",
      year: "2024",
      summary: "Provides practical preparation, player welfare, and safe participation principles for training and match environments.",
      link: "https://passport.world.rugby/player-welfare/rugby-ready/",
    },
    "wr-activate": {
      title: "Activate Injury Prevention Programme",
      organisation: "World Rugby",
      year: "2024",
      summary: "Highlights warm-up structure, movement control, and injury-prevention habits that improve player availability.",
      link: "https://passport.world.rugby/player-welfare/activate/",
    },
    "wr-nutrition-hydration": {
      title: "Nutrition, Rehydration and Refuelling Guidance",
      organisation: "World Rugby",
      year: "2023",
      summary: "Frames food, fluid, and recovery as repeatable daily habits rather than extreme short-term fixes.",
      link: "https://passport.world.rugby/conditioning-for-rugby/nutrition/",
    },
    "wr-load-management": {
      title: "Player Load and Recovery Guidance",
      organisation: "World Rugby",
      year: "2023",
      summary: "Supports sensible progression, communication about soreness, and balanced training load decisions.",
      link: "https://passport.world.rugby/player-welfare/",
    },
    "wr-safeguarding": {
      title: "Safeguarding Best Practice",
      organisation: "World Rugby",
      year: "2024",
      summary: "Reinforces inclusion, welfare reporting, and the importance of safe adult support around young players.",
      link: "https://passport.world.rugby/player-welfare/safeguarding/",
    },
    "irfu-ltpd": {
      title: "Long-Term Player Development",
      organisation: "IRFU",
      year: "2022",
      summary: "Provides stage-based priorities for skill, physical development, and player support across the pathway.",
      link: "https://www.irishrugby.ie/playing-the-game/spirit-of-rugby/long-term-player-development/",
    },
    "irfu-technical-model": {
      title: "IRFU Technical Model",
      organisation: "IRFU",
      year: "2023",
      summary: "Connects skill execution, decision-making, and game understanding to player development outcomes.",
      link: "https://www.irishrugby.ie/playing-the-game/coaching/",
    },
    "irfu-holistic": {
      title: "Holistic Player Development Programme",
      organisation: "IRFU",
      year: "2023",
      summary: "Supports whole-player thinking across rugby, education, life balance, and personal growth.",
      link: "https://www.irishrugby.ie/playing-the-game/",
    },
    "irfu-wellbeing": {
      title: "Club and Community Wellbeing Guidance",
      organisation: "IRFU",
      year: "2023",
      summary: "Encourages safe reporting, belonging, and the role of adults in creating supportive environments.",
      link: "https://www.irishrugby.ie/playing-the-game/spirit-of-rugby/",
    },
    "barden-activate": {
      title: "Schoolboy Rugby Injury Prevention Research on Activate",
      organisation: "Barden et al.",
      year: "2021",
      summary: "Peer-reviewed work supporting structured warm-up use and injury-reduction habits in youth rugby settings.",
      link: "https://bjsm.bmj.com/",
    },
    "nsca-youth-strength": {
      title: "Youth Resistance Training Position Statement",
      organisation: "National Strength and Conditioning Association",
      year: "2009",
      summary: "Supports supervised, technique-led strength training for young athletes when matched to age and experience.",
      link: "https://journals.lww.com/nsca-jscr/fulltext/2009/08000/youth_resistance_training__updated_position.1.aspx",
    },
    "youth-athletic-development": {
      title: "Youth Athletic Development Position Statement",
      organisation: "UKSCA and international collaborators",
      year: "2016",
      summary: "Explains why speed, strength, movement skill, and long-term progression matter during adolescence.",
      link: "https://bjsm.bmj.com/content/50/20/1249",
    },
    "donau-practice": {
      title: "Donau Academy Practice",
      organisation: "Rugby Union Donau",
      year: "2026",
      summary: "Local coaching language and player-support habits used to connect federation guidance to the Donau environment.",
      link: "",
    },
  };
  const developmentStageProfiles = {
    "development-hub": {
      u14: {
        label: "U14",
        focus: "Enjoy the game, build broad skills, and learn safe habits.",
        priorities: ["Enjoyment", "Broad movement", "Core skills", "Safe contact habits", "Experiment with positions", "Basic training habits"],
      },
      u16: {
        label: "U16",
        focus: "Handle more pressure, better decisions, and stronger self-management.",
        priorities: ["Skill under pressure", "Better decisions", "Position understanding", "Structured physical preparation", "Communication", "Self-management"],
      },
      u18u19: {
        label: "U18/U19",
        focus: "Prepare for consistency, tactical responsibility, and senior demands.",
        priorities: ["Consistency", "Tactical responsibility", "Individual preparation", "Balancing school and rugby", "Recovery ownership", "Senior transition"],
      },
      senior: {
        label: "Senior transition",
        focus: "Adapt to speed, physicality, and new expectations without losing confidence.",
        priorities: ["Adapting to speed and physicality", "Role clarity", "Communicating with senior coaches", "Load awareness", "Maintaining confidence"],
      },
    },
    "strength-conditioning": {
      u14: {
        label: "U14",
        focus: "Learn how to move, land, and accelerate well before chasing heavy load.",
        priorities: ["Movement vocabulary", "Landing mechanics", "Short accelerations", "Fun competition", "Warm-up habits"],
      },
      u16: {
        label: "U16",
        focus: "Improve technique, speed quality, and structured physical preparation.",
        priorities: ["Technique before load", "Deceleration", "Speed exposure", "Strength supervision", "Recovery routine"],
      },
      u18u19: {
        label: "U18/U19",
        focus: "Build robustness and repeatability for heavier rugby demands.",
        priorities: ["Force production", "Sprint repeatability", "Position demands", "Readiness communication", "Availability"],
      },
      senior: {
        label: "Senior transition",
        focus: "Train with enough quality to stay available and handle senior intensity.",
        priorities: ["Load awareness", "Contact resilience", "Consistent strength work", "High-speed exposure", "Return-to-play discipline"],
      },
    },
    nutrition: {
      u14: {
        label: "U14",
        focus: "Keep food and hydration simple, familiar, and consistent.",
        priorities: ["Regular meals", "Water habits", "Simple snacks", "Sleep routine", "Family support"],
      },
      u16: {
        label: "U16",
        focus: "Match daily fuel to training and start preparing more independently.",
        priorities: ["Training-day choices", "Hydration awareness", "Pack food early", "Post-training meal", "Matchday routine"],
      },
      u18u19: {
        label: "U18/U19",
        focus: "Take ownership of match preparation, travel planning, and recovery habits.",
        priorities: ["Meal timing", "Travel planning", "Recovery sequence", "Communication about needs", "Consistent sleep"],
      },
      senior: {
        label: "Senior transition",
        focus: "Handle tougher schedules and recovery demands without overcomplicating food.",
        priorities: ["Busy-week planning", "Fluid discipline", "Recovery after contact", "Work-study balance", "Prepare before travel"],
      },
    },
    wellbeing: {
      u14: {
        label: "U14",
        focus: "Feel welcome, safe, and able to speak to trusted adults.",
        priorities: ["Belonging", "Friendships", "Safe team behavior", "Enjoyment", "Knowing who can help"],
      },
      u16: {
        label: "U16",
        focus: "Handle setbacks better and communicate early when life feels heavy.",
        priorities: ["Confidence after mistakes", "Pressure skills", "Work-school balance", "Sleep", "Speaking up early"],
      },
      u18u19: {
        label: "U18/U19",
        focus: "Protect energy, perspective, and support networks during demanding seasons.",
        priorities: ["Managing pressure", "Role clarity", "Recovery habits", "Identity beyond selection", "Support network"],
      },
      senior: {
        label: "Senior transition",
        focus: "Stay connected and realistic while adapting to new expectations.",
        priorities: ["Belonging in a new group", "Confidence through change", "Communication", "Load and life balance", "Seeking support early"],
      },
    },
  };

  window.DONAU_DATA = {
    attackData: {
      setpiece: [
        {
          name: "O\u00b3",
          type: "Scrum Starter",
          detail: [
            "9 + 12 fix Opp 10 inside",
            "10 out the back, straightens to fix Opp 12",
            "11 hits seam at pace",
            "13 fixes Opp 13, back three hold width",
          ],
          diagram: asset("images/O\u00b3.png"),
        },
        {
          name: "C.C +",
          type: "Scrum \u2014 Kicking Option",
          detail: [
            "Attacking kicking option: 8 to 9, 9 to 10 behind 12",
            "10 kicks for 14/15",
            "Positioning on field requires read of their 15",
          ],
          diagram: asset("images/C.C+.png"),
        },
        {
          name: "Launch 41",
          type: "Scrum Starter",
          detail: [
            "9 to 14, 12 short (attacking opp 10)",
            "10 out back",
            "Option of playing slider between 13/15",
          ],
          diagram: asset("images/Launch 41.png"),
        },
        {
          name: "Rhino & Lion",
          type: "Mid Field Scrum",
          detail: [
            "RHINO (Right)",
            "8 to 9",
            "12 unders to fix inside",
            "Out the back to 10",
            "14 as outside option",
            "LION (Left)",
            "9 takes easy space left",
            "Fix Opp 10",
            "13 to 10",
            "Pop to 15 or straight to 11",
          ],
          diagram: asset("images/Mid Field Scrum.png"),
        },
        {
          name: "Special",
          type: "Lineout",
          detail: [],
          diagram: asset("images/LO  Special.png"),
        },
      ],
      phase: [
        {
          name: "Strike",
          type: "Phase Direction",
          detail: [
            "9 passes across face of forwards to 1st receiver",
            "1st receiver must push up (flatter) \u2014 due to front-foot ball",
            "Gives ball to a deeper backline",
            "Default when ball is fast and positive",
          ],
        },
        {
          name: "Roll",
          type: "Phase Direction",
          detail: [
            "Ball passed behind forward runners",
            "Forward pod runs hard and remains an option if defenders don't bite",
            "Creates space for deeper 1st receiver",
            "Flatter backline option",
          ],
        },
        {
          name: "Kick Start",
          type: "Slow Ball \u2014 Gold Zone",
          detail: [
            "Slow ball movements targeted to speed the game back up",
            "Play towards the posts to give TWO SIDES",
            "Kick, Block, Fetch, Fetch, Latch Pick \u2014 draw in 3rd defender",
            "Skills: pick with 4 legs vs 2, target defenders 2/3, low powerful leg drive",
          ],
        },
        {
          name: "Spark",
          type: "Slow Ball \u2014 Gold Zone",
          detail: [
            "Simple option to maintain shape",
            "Move hammer or sickles close to 9",
            "Early latch and drive into contact",
          ],
        },
        { name: "Snap", type: "Call", detail: ["Switch pass"] },
        { name: "Crackle", type: "Call", detail: ["Dummy Snap with unders/overs"] },
        { name: "Snoop", type: "Call", detail: ["Cut, double loop"] },
        { name: "Doggy", type: "Call", detail: ["Circle ball"] },
        { name: "Firefly", type: "Call", detail: ["Blocker \u2014 both options available"] },
        {
          name: "Trigger",
          type: "Call",
          detail: ["Point passes behind tip to a back who transfers the ball"],
        },
        { name: "Turbo", type: "Call", detail: ["Pick and drive"] },
        { name: "Rails", type: "Call", detail: ["Inside ball"] },
        { name: "Charlie's", type: "Call", detail: ["-"] },
        { name: "ML", type: "Call", detail: ["-"] },
        { name: "LA", type: "Call", detail: ["-"] },
        { name: "Special", type: "Call", detail: ["-"] },
      ],
      exits: [
        {
          name: "Driver",
          type: "Exit Kick Type",
          detail: ["Long kick \u2014 goal: ball in touch past our 40m OR long kick bouncing over halfway"],
        },
        {
          name: "Bingo",
          type: "Exit Kick Type",
          detail: ["Contestable kick \u2014 get possession back inside 40m line"],
        },
        {
          name: "Banana",
          type: "Exit Kick Type",
          detail: ["Box kick \u2014 used from lineout (72 Banana), down and feed to 9 then kick"],
        },
        { name: "Zero", type: "Exit Option", detail: ["Bail-out option when under pressure"] },
        {
          name: "Ramp 1 \u2014 Left",
          type: "Exit from Lineout Left",
          detail: [
            "Phase 1: 9 to 8, then 11/12/8/7 to breakdown, 10 stays in pocket",
            "Phase 2: Sickles around the corner or block (Right Side)",
            "Phase 3: 9 to 15 \u2014 kick (driver or bingo) or run option",
          ],
        },
        {
          name: "Ramp 2 \u2014 Right",
          type: "Exit from Lineout Right",
          detail: [
            "Phase 1: 9 to 8, 14/12/8/7 to breakdown, 10 stays in pocket",
            "Phase 2: Sickles stay on right side",
            "9 back to 10 to kick out or option to shift left with numbers",
          ],
        },
      ],
      calls: [
        { name: "PAINT", type: "Field Landmark", detail: ["Sideline on both sides of the field"] },
        { name: "ROCK", type: "Field Landmark", detail: ["Centre field \u2014 Hammers' running line"] },
        { name: "COAST", type: "Field Landmark", detail: ["15m line on either side \u2014 Sickles' running line"] },
        { name: "BERMUDA", type: "Field Landmark", detail: ["Between Rock and the Coast on both sides"] },
        { name: "BLACK", type: "Direction", detail: ["Off 9 to pod"] },
        { name: "RED", type: "Direction", detail: ["Off 9 to 10/12"] },
        { name: "SUNSHINE", type: "Direction", detail: ["Change direction off 9"] },
        { name: "PINK", type: "Direction", detail: ["Off 9 out the back to playmaker"] },
        { name: "TONGA", type: "Scrum Delivery", detail: ["8 to 9 standard delivery"] },
        { name: "FIJI", type: "Scrum Delivery", detail: ["Through legs delivery"] },
        { name: "RAMBO", type: "Scrum Delivery", detail: ["8 takes the ball himself"] },
        { name: "RIVER", type: "Scrum 42", detail: ["Right side \u2014 8-9-15-14"] },
        { name: "LAKE", type: "Scrum 42", detail: ["Left side \u2014 hands to 11 with 10 or 12 skipping, or Snoop"] },
        { name: "MUST", type: "Override", detail: ["Must get the ball \u2014 overrides all other calls"] },
        { name: "DARK", type: "Direction", detail: ["Blind side"] },
      ],
    },
    lo80: [
      { name: "L \u2014 Alpha", sub: "80/70 Formation", detail: "1 and 6 lift 4 at the front. Alpha: 5 arrives last and rushes forward to lift 4." },
      { name: "N \u2014 Dummy L", sub: "80/70 Formation", detail: "Dummy L with 1 going past and lifting 6." },
      { name: "E \u2014 Forward Move", sub: "80/70 \u2014 Trigger 4 (163)", detail: "Dummy L as 5 moves forward inside 3/6 (1 step dummy and back), then 3 lifts 5." },
      { name: "O \u2014 Back Move", sub: "80/70 \u2014 Trigger 4 (653)", detail: "Dummy L, 5 goes one step forward and up lifted by 3 and 8." },
      { name: "U \u2014 Counter", sub: "80/70 \u2014 Trigger 4 (387)", detail: "Dummy N as 5 moves back to 8, then 8 and 7 slide past 5 to 3. 3 and 7 lift 8." },
      { name: "T \u2014 Tail", sub: "80/70 \u2014 Trigger 4 (587)", detail: "Dummy L as 5 moves back to 8, 8 is lifted by 5 and 7." },
      { name: "CAT \u2014 Front", sub: "All Formations", detail: "Throw to the front man. Used when space is clear at front." },
      { name: "I \u2014 No Jump", sub: "80/70 \u2014 Trigger 2 (4)", detail: "No jump \u2014 throw directly to 4 without a lift." },
    ],
    lo50: [
      { name: "L \u2014 Front Lift", sub: "50 Formation \u2014 Trigger 4 (145)", detail: "4 lifted at front by 1 and 5. Alpha: 5 arrives last and rushes forward to lift 4." },
      { name: "O \u2014 Back Lift", sub: "50 Formation \u2014 Trigger 8 (458)", detail: "4 turns and lifts 5 with 8. Zulu: 5 arrives last and rushes back to lift 8." },
      { name: "U \u2014 Counter", sub: "50 Formation \u2014 Trigger 5 (483)", detail: "Dummy T: 5 moves back to 8, 8 and 3 slide past 5 to 4. 4 and 3 lift 8." },
      { name: "T \u2014 Tail", sub: "50 Formation \u2014 Trigger 4 (583)", detail: "4 fakes forward to 1. At the same time 5 comes back to lift 8 with 3." },
      { name: "L \u2014 40 Front", sub: "40 Formation \u2014 Trigger 4 (145)", detail: "4 lifted at front by 1 and 5. Alpha same as L. Zulu same as O." },
      { name: "E \u2014 Dummy O", sub: "40 Formation \u2014 Trigger 4 (158)", detail: "Dummy O: as 4 comes back, 5 and 8 move to 1." },
      { name: "O \u2014 40 Back", sub: "40 Formation \u2014 Trigger 2 (458)", detail: "4 and 8 lift 5 off the standard 40 setup." },
    ],
    defData: {
      rhs: {
        green: {
          title: "Green Zone \u2014 Low Risk",
          color: "g",
          points: [
            "9 chases up and around to close off shortside OR moves to neutral (based on width, scrum screw, opp blind winger)",
            "9 closing off shortside enables a 2-fullback mentality",
            "Shortside winger can change picture: start deep and move forward, or start flat and move back",
            "Pendulum with 14/15/11 constantly working",
            "Kick return: open winger connects with 15, 13 connects to end of the line",
            "BR: 7 covering 8/connection with 10; 8 working hard in the pocket; 6 awareness of shortside",
          ],
        },
        orange: {
          title: "Orange Zone \u2014 Mid Field",
          color: "o",
          points: [
            "9 closes off shortside OR moves to neutral as above",
            "If attacking blind winger aligns between 9 and 10, defending 9 matches alignment, blind winger covers with 6",
            "This drags 15 across with open winger dropping back into pocket",
            "Pendulum with 14/15/11 constantly working",
            "7 covers 8/9 (soften up, don't bite hard on the 9); 8 in pocket; 6 aware of shortside",
          ],
        },
        red: {
          title: "Red Zone \u2014 Danger",
          color: "r",
          points: [
            "9 closes off shortside OR moves to neutral",
            "Blind winger always holds shortside initially, must move quickly on pass to cover short kick/run threat",
            "Blind winger can get behind scrum if on 5m line and 9 can cover 7/10 seam & short kick",
            "Defending 15 alert to cover short kicks",
            "STORM option: aggressive up-and-in, 100% commitment, 10 moves up first to sell system",
          ],
        },
      },
      lhs: {
        green: {
          title: "Green Zone \u2014 Low Risk",
          color: "g",
          points: [
            "9 stays on scrum feed side OR moves to neutral (width, scrum screw)",
            "Backline players align outside shoulder of their attacker and push quickly into next channel",
            "D9=No.8, D10=1st attacker, D12=2nd, D13=3rd, D14=2nd last, D15=last attacker",
            "Pendulum with 14/15/11 constantly working",
            "BR: 7 connecting with D10; 8 working hard in pocket; 6 awareness of shortside",
          ],
        },
        orange: {
          title: "Orange Zone \u2014 Mid Field",
          color: "o",
          points: [
            "9 stays on feed side OR neutral",
            "Defending blind winger must hold shortside until ball is released open",
            "Backline players align outside shoulder of attacker, push quickly into next channel",
            "Must be aware of attacking blind wing and 15 alignment prior to ball being fed",
            "Shuffle call can change the picture",
            "BR: 7 covering inside 9; 8 in pocket; 6 shortside awareness",
          ],
        },
        red: {
          title: "Red Zone \u2014 Danger",
          color: "r",
          points: [
            "Defensive 9 aware of neutral position to cover shortside",
            "D15 starts in pocket of D13 & D14 to cover short kick or cover sideline quickly",
            "Blind winger holds more width on shortside for 8/9/winger, covers on pass open",
            "Midfield holds square",
            "STORM also an option",
          ],
        },
      },
      cfs: {
        green: {
          title: "Centre Field Scrum \u2014 Green Zone",
          color: "g",
          points: [
            "10/12 defend together on the side with highest numbers",
            "9 pressures/takes 10/scrum angle",
            "13 works hard with 7 for connection \u2014 soften up, no need to bite hard narrow",
            "Pendulum with 11/15/14 constantly working",
            "BR: 7 defends less numbers side (quicker footspeed than 6), covers 8/9; 8 in pocket both sides; 6 connects with 10",
          ],
        },
        orange: {
          title: "Centre Field Scrum \u2014 Orange Zone",
          color: "o",
          points: [
            "Same principles as green but with higher defensive urgency",
            "10 and 12 aware of attacking shape between them",
            "9 decisions on scrum angle become more critical",
          ],
        },
        red: {
          title: "Centre Field Scrum \u2014 Red Zone",
          color: "r",
          points: [
            "Lake: 9-10 kick for exit",
            "River: 8-9-15 kick for exit",
            "Running options same as rest of the field",
            "STORM change-up available",
          ],
        },
      },
    },
    workspaceSections: [
      { slide: 1, group: "Performance", shortLabel: "Intro", title: "Intro" },
      { slide: 2, group: "Performance", shortLabel: "Standards", title: "Standards" },
      { slide: 3, group: "Performance", shortLabel: "Attack", title: "Attack" },
      { slide: 4, group: "Performance", shortLabel: "Lineout", title: "Lineout" },
      { slide: 5, group: "Performance", shortLabel: "Defence", title: "Defence" },
      { slide: 6, group: "Performance", shortLabel: "Playbook", title: "Ask the Playbook" },
      { slide: 7, group: "Development", shortLabel: "Hub", title: "Development" },
      { slide: 8, group: "Development", shortLabel: "Athletic", title: "Athletic Development" },
      { slide: 9, group: "Development", shortLabel: "Fuel", title: "Fuel & Recovery" },
      { slide: 10, group: "Development", shortLabel: "Wellbeing", title: "Player Wellbeing" },
      { slide: 11, group: "Development", shortLabel: "Pathway", title: "Player Pathway" },
    ],
    developmentSupportConfig,
    developmentEvidenceLibrary,
    developmentStageProfiles,
    developmentModules: [
      {
        id: "development-hub",
        slide: 7,
        iconType: "compass",
        accent: "green",
        title: "Development",
        experience: "premium",
        category: "Development",
        estimatedTime: "8-10 min",
        hero: {
          headline: "Build Your Game, One Step at a Time",
          copy: "Every player develops at a different speed. You do not need to be perfect today. Understand your next step, practise with purpose and keep moving forward.",
          primaryAction: "Start here",
          secondaryAction: "Explore my age stage",
        },
        quickStart: {
          label: "Three-minute start",
          importantIdea: "Development works best when you focus on one clear next step instead of trying to fix everything at once.",
          practicalAction: "Choose one skill, habit, or behavior to improve this week and connect it to one moment in rugby.",
          reflectionQuestion: "What would feel noticeably better in my rugby if I improved one small thing consistently?",
        },
        whyItMatters: [
          {
            title: "Late in the match",
            body: "When fatigue rises, players still need skill, movement quality, and good decisions. Development is what keeps standards alive under pressure.",
          },
          {
            title: "After a mistake",
            body: "A player who can review, reset, and choose the next useful action grows faster than a player who only chases perfection.",
          },
          {
            title: "Across the season",
            body: "Improvement comes from repeated cycles of observing, practicing, and reviewing - not from one big session or one big game.",
          },
        ],
        topicCards: [
          {
            id: "skill",
            title: "Rugby Skill",
            purpose: "Turn practice time into better actions under pressure.",
            rugbyExample: "Can you catch, pass, tackle, and reload cleanly when the game speeds up?",
            action: "Pick one core skill to repeat with intent this week.",
            relatedModule: "Athletic Development",
            details: [
              "Why it matters: clean basics give you more good options in the game.",
              "On-pitch example: a fast reload after a tackle keeps the line connected.",
              "This week: choose one skill cue you can repeat in every training block.",
            ],
          },
          {
            id: "understanding",
            title: "Game Understanding",
            purpose: "Read the picture sooner and make calmer decisions.",
            rugbyExample: "Do you recognise when to play fast, when to scan, and where the pressure is coming from?",
            action: "Review one game moment and name the better option for next time.",
            relatedModule: "Player Pathway",
            details: [
              "Why it matters: game understanding helps skills arrive at the right moment.",
              "On-pitch example: identifying space before the ball reaches you changes the whole action.",
              "This week: after training, describe one decision you made well and one you want to improve.",
            ],
          },
          {
            id: "athletic",
            title: "Athletic Development",
            purpose: "Move well, stay available, and handle rugby demands with confidence.",
            rugbyExample: "Can you accelerate, decelerate, land, and repeat efforts safely?",
            action: "Notice one movement quality you want to sharpen in warm-up or gym work.",
            relatedModule: "Athletic Development",
            details: [
              "Why it matters: better movement supports contact, speed, and resilience.",
              "On-pitch example: staying balanced into contact helps you keep power and control.",
              "This week: treat your warm-up as skill practice, not as dead time before rugby.",
            ],
          },
          {
            id: "habits",
            title: "Habits and Lifestyle",
            purpose: "Build simple routines that support training, school, work, and recovery.",
            rugbyExample: "Are you arriving prepared, hydrated, and ready to learn?",
            action: "Prepare one part of your training day earlier than usual this week.",
            relatedModule: "Fuel & Recovery",
            details: [
              "Why it matters: consistent habits create more quality sessions over time.",
              "On-pitch example: good pre-training routines improve focus before the first drill even starts.",
              "This week: pack food, kit, and water before the day gets busy.",
            ],
          },
          {
            id: "mindset",
            title: "Mindset and Wellbeing",
            purpose: "Protect confidence, perspective, and support-seeking habits.",
            rugbyExample: "How do you respond after a mistake, a bad session, or a heavy week?",
            action: "Name one person you can speak to when rugby or life feels heavy.",
            relatedModule: "Player Wellbeing",
            details: [
              "Why it matters: calm support and honest reflection help players keep improving.",
              "On-pitch example: a player who resets quickly after an error can still influence the next phase.",
              "This week: practice one reset phrase you can use after mistakes.",
            ],
          },
        ],
        specialFeature: {
          type: "compass",
          title: "Development Compass",
          cycleTitle: "Observe -> Choose -> Practise -> Review -> Repeat",
          cycleSteps: [
            { title: "Observe", text: "Notice what actually happens in training, matches, and recovery." },
            { title: "Choose", text: "Pick one next action that is clear, realistic, and controllable." },
            { title: "Practise", text: "Repeat the action enough times for it to feel familiar." },
            { title: "Review", text: "Look back honestly at what improved and what still needs work." },
            { title: "Repeat", text: "Keep going with the next useful step instead of starting over." },
          ],
        },
        practicalTool: {
          type: "next-step",
          title: "My Next Step",
          intro: "Turn reflection into one simple development action you can actually follow this week.",
          fields: [
            { id: "goal", label: "What do I want to improve?" },
            { id: "why", label: "Why will it help my rugby?" },
            { id: "practice", label: "What will I practise?" },
            { id: "support", label: "Who can help me?" },
            { id: "progress", label: "How will I recognise progress?" },
          ],
        },
        guidance: {
          coachPrinciple: "Give the player one clear, controllable next action.",
          parentPrinciple: "Ask what the player learned and enjoyed before asking about the result.",
          coachTips: [
            "Keep feedback short enough that the player can use it immediately.",
            "Connect corrections to one game picture, not a long lecture.",
            "Review progress with the player instead of guessing for them.",
          ],
          parentTips: [
            "Notice effort, learning, and enjoyment as well as outcomes.",
            "Help create routines around food, sleep, travel, and preparation.",
            "Encourage honest communication when rugby feels heavy.",
          ],
        },
        ageStageKey: "development-hub",
        evidenceGroups: {
          "World Rugby guidance": ["wr-conditioning-children", "wr-conditioning-youth", "wr-rugby-ready"],
          "IRFU guidance": ["irfu-ltpd", "irfu-holistic"],
          "Peer-reviewed research": ["youth-athletic-development"],
          "Donau club practice": ["donau-practice"],
        },
        continueJourney: {
          nextSlide: 8,
          nextLabel: "Athletic Development",
          relatedTopic: "Use My Next Step before your next training week.",
        },
      },
      {
        id: "strength-conditioning",
        slide: 8,
        iconType: "athletic",
        accent: "silver",
        title: "Athletic Development",
        experience: "premium",
        category: "Development",
        estimatedTime: "10-12 min",
        hero: {
          headline: "Build the Athlete Behind the Player",
          copy: "Athletic development is not about looking like a professional player. It is about moving well, producing force safely, repeating efforts and staying available to play.",
          primaryAction: "Start here",
          secondaryAction: "Explore my age stage",
        },
        quickStart: {
          label: "Three-minute start",
          importantIdea: "Good athletic development starts with movement quality and repeatable habits, not with chasing exhaustion.",
          practicalAction: "Before your next session, choose one movement quality to own: posture, landing, acceleration, or deceleration.",
          reflectionQuestion: "What part of my movement helps me most in rugby - and what still feels unstable?",
        },
        whyItMatters: [
          {
            title: "Accelerating into space",
            body: "Speed is not only top pace. Your first steps, body position, and ability to react often decide whether you win the moment.",
          },
          {
            title: "Holding shape late in the match",
            body: "Rugby fitness helps you repeat high-intensity actions and recover quickly enough to contribute again.",
          },
          {
            title: "Staying available",
            body: "Warm-up quality, gradual progression, and early communication about pain or soreness help players train more often.",
          },
        ],
        topicCards: [
          {
            id: "move",
            title: "Move",
            purpose: "Build movement quality that transfers to rugby actions.",
            rugbyExample: "Can you land, brace, accelerate, and change direction under control?",
            action: "Choose one movement family to notice in warm-up this week.",
            details: [
              "Movement families: squat, hinge, lunge, brace, push, pull, land, accelerate, decelerate, and change direction.",
              "Technique comes before adding difficulty.",
              "Better movement supports speed, contact, and confidence.",
            ],
          },
          {
            id: "strength",
            title: "Strength",
            purpose: "Use strength to support contact, sprinting, stability, and resilience.",
            rugbyExample: "A stronger brace and leg drive help you stay connected through contact.",
            action: "Ask whether the goal of the session is technique, force, or repeatability.",
            details: [
              "Technique before load.",
              "Gradual progression with qualified supervision.",
              "Full-body development matters more than chasing one body part.",
            ],
          },
          {
            id: "speed",
            title: "Speed",
            purpose: "Train quality fast actions with enough recovery to keep them fast.",
            rugbyExample: "Winning the first three steps often creates the break, not only maximum speed.",
            action: "Protect your fastest efforts with enough rest between them.",
            details: [
              "Acceleration, reaction, deceleration, and change of direction all matter.",
              "Fast work needs quality repetitions and recovery.",
              "Speed training should feel sharp, not sloppy.",
            ],
          },
          {
            id: "fitness",
            title: "Rugby Fitness",
            purpose: "Condition for the repeated efforts your position actually needs.",
            rugbyExample: "Recovering fast enough to tackle, reload, and carry again changes match impact.",
            action: "After conditioning, ask what game demand the session matched.",
            details: [
              "Repeated high-intensity effort matters alongside aerobic recovery.",
              "Purposeful conditioning beats random fatigue.",
              "Harder is not automatically better if quality disappears.",
            ],
          },
          {
            id: "availability",
            title: "Availability",
            purpose: "Stay ready to train by respecting preparation and recovery habits.",
            rugbyExample: "Players help the team most when they can train and compete consistently.",
            action: "Report soreness or pain early instead of hiding it.",
            details: [
              "Use Activate-style warm-up structure, neck and shoulder prep, balance, and landing control.",
              "Progress gradually across busy weeks.",
              "Return-to-play decisions should stay with qualified adults and professionals.",
            ],
          },
        ],
        specialFeature: {
          type: "wheel",
          title: "Athletic Development Wheel",
          segments: ["Move", "Strength", "Speed", "Rugby Fitness", "Availability"],
          weekTitle: "My Athletic Week",
          weekItems: ["Rugby", "Strength", "Speed", "Recovery", "Match", "Rest"],
        },
        practicalTool: {
          type: "readiness",
          title: "Today's Readiness",
          intro: "Use this quick check-in to support self-awareness and communication. It is not a diagnosis, selection score, or competition.",
          prompts: ["Sleep", "Energy", "Soreness", "Stress", "Motivation"],
        },
        ageStageKey: "strength-conditioning",
        evidenceGroups: {
          "World Rugby guidance": ["wr-conditioning-youth", "wr-activate", "wr-load-management"],
          "IRFU guidance": ["irfu-ltpd", "irfu-technical-model"],
          "Peer-reviewed research": ["barden-activate", "nsca-youth-strength", "youth-athletic-development"],
          "Donau club practice": ["donau-practice"],
        },
        continueJourney: {
          nextSlide: 9,
          nextLabel: "Fuel & Recovery",
          relatedTopic: "Compare your readiness with how you recover after training.",
        },
      },
      {
        id: "nutrition",
        slide: 9,
        iconType: "fuel",
        accent: "gold",
        title: "Fuel & Recovery",
        experience: "premium",
        category: "Development",
        estimatedTime: "9-11 min",
        hero: {
          headline: "Fuel the Work. Recover for What Comes Next.",
          copy: "You do not need a perfect diet or expensive products. Consistent meals, enough fluid and good recovery habits make the biggest difference.",
          primaryAction: "Start here",
          secondaryAction: "Explore my age stage",
        },
        quickStart: {
          label: "Three-minute start",
          importantIdea: "Simple daily habits usually beat complicated plans you cannot repeat.",
          practicalAction: "Before your next rugby day, decide when you will eat, drink, and refuel afterwards.",
          reflectionQuestion: "Which part of my routine usually breaks down first when the day gets busy?",
        },
        whyItMatters: [
          {
            title: "Preparing for matchday",
            body: "Good fuel helps players arrive with energy instead of trying to catch up late with rushed choices.",
          },
          {
            title: "Recovering after repeated efforts",
            body: "Food, fluid, and sleep support the next training session as much as the one you just finished.",
          },
          {
            title: "Balancing school and training",
            body: "Planning simple, realistic options makes better habits easier even on long days.",
          },
        ],
        topicCards: [
          {
            id: "everyday-fuel",
            title: "Everyday Fuel",
            purpose: "Build a flexible plate and hydration routine that works in real life.",
            rugbyExample: "Consistent food helps you keep quality during contact, sprint, and review sessions.",
            action: "Look at your next main meal and name the energy source, protein, color, and fluid.",
            details: [
              "Flexible plate builder: energy source, protein source, fruit or vegetables, and fluid.",
              "Affordable and culturally varied foods all count.",
              "Do not label food as morally good or bad.",
            ],
          },
          {
            id: "training-day",
            title: "Training Day",
            purpose: "Match food and fluid choices to the time you actually have.",
            rugbyExample: "Arriving underfueled can make learning and decision-making feel harder than they should.",
            action: "Choose your best option for today: normal meal, lighter meal, or quick familiar snack.",
            details: [
              "Normal meal several hours before training.",
              "Lighter meal or snack closer to training.",
              "Simple, easy-to-digest option when time is limited.",
            ],
          },
          {
            id: "matchday",
            title: "Matchday",
            purpose: "Create a calm routine from the evening before to after the final whistle.",
            rugbyExample: "A player who plans travel, food, and fluids arrives more settled and ready to perform.",
            action: "Map one full matchday timeline before the week gets hectic.",
            details: [
              "Evening before, breakfast, pre-match meal, travel, arrival, warm-up, half-time, after the match.",
              "Use familiar foods you already know work for you.",
              "Keep choices practical rather than perfect.",
            ],
          },
          {
            id: "recovery",
            title: "Recovery",
            purpose: "Use simple habits to reset the body and the mind after effort.",
            rugbyExample: "Players recover better when they rehydrate, eat, move lightly, and sleep well after contact load.",
            action: "Choose one thing you will do within the first hour after your next hard session.",
            details: [
              "Recovery sequence: Rehydrate -> Eat -> Reset -> Sleep.",
              "Recovery also includes rest, light movement, connection, and stress management.",
              "Appropriate healthcare and early communication still matter.",
            ],
          },
          {
            id: "myths",
            title: "Myth or Useful Habit",
            purpose: "Separate flashy claims from reliable foundations.",
            rugbyExample: "Players often hear about supplements and energy drinks before they master basics.",
            action: "Check whether the idea you heard improves training, food, sleep, or just sounds impressive.",
            details: [
              "Myth: I need supplements to become stronger. Useful habit: training, normal food, and sleep come first.",
              "Myth: Energy drinks are normal sports hydration. Useful habit: water and consistent food habits are the foundation.",
              "Myth: Recovery starts after the match. Useful habit: recovery is built through daily habits.",
            ],
          },
        ],
        specialFeature: {
          type: "plate",
          title: "Fuel Builder",
          columns: ["Energy source", "Protein source", "Fruit or vegetables", "Fluid"],
          timeline: ["Evening before", "Breakfast", "Pre-match meal", "Travel", "Arrival", "Warm-up", "Half-time", "After the match"],
        },
        practicalTool: {
          type: "matchday-plan",
          title: "My Matchday Plan",
          intro: "Create an editable checklist based on your match time, travel, weather, and what is actually available to you.",
          weatherOptions: ["Cold", "Mild", "Warm", "Hot"],
        },
        safetyNotice: {
          title: "Extra support matters here",
          body: "Allergies, medical conditions, special dietary needs, supplement questions, and persistent sleep difficulties should be discussed with parents and qualified professionals.",
        },
        ageStageKey: "nutrition",
        evidenceGroups: {
          "World Rugby guidance": ["wr-nutrition-hydration", "wr-load-management"],
          "IRFU guidance": ["irfu-ltpd", "irfu-holistic"],
          "Peer-reviewed research": ["youth-athletic-development"],
          "Donau club practice": ["donau-practice"],
        },
        continueJourney: {
          nextSlide: 10,
          nextLabel: "Player Wellbeing",
          relatedTopic: "Notice how food, fluid, and sleep affect mood and concentration too.",
        },
      },
      {
        id: "wellbeing",
        slide: 10,
        iconType: "wellbeing",
        accent: "muted-green",
        title: "Player Wellbeing",
        experience: "premium",
        category: "Development",
        estimatedTime: "8-10 min",
        hero: {
          headline: "The Person Comes Before the Player",
          copy: "Rugby should be a place where you can learn, belong and ask for support. Good players are not expected to handle every challenge alone.",
          primaryAction: "Start here",
          secondaryAction: "Explore my age stage",
        },
        quickStart: {
          label: "Three-minute start",
          importantIdea: "Feeling safe, connected, and supported helps players learn and perform more consistently.",
          practicalAction: "Before your next rugby week, name one person, one routine, and one habit that helps you reset.",
          reflectionQuestion: "When rugby feels heavy, what helps me feel steady again?",
        },
        whyItMatters: [
          {
            title: "Communicating after a mistake",
            body: "Players who can reset after errors stay present in the next phase instead of disappearing from the game.",
          },
          {
            title: "Balancing rugby, school, and life",
            body: "Performance naturally changes when the week gets heavy. Honest planning helps players cope earlier.",
          },
          {
            title: "Asking for support",
            body: "Speaking up early is a strength because it protects learning, safety, and long-term enjoyment of rugby.",
          },
        ],
        topicCards: [
          {
            id: "belonging",
            title: "Belonging",
            purpose: "Create a team environment where players feel welcomed and respected.",
            rugbyExample: "New players settle faster when teammates include them early and explain the standards clearly.",
            action: "Do one small thing this week that makes someone else feel more included.",
            details: [
              "Respect, inclusion, and protecting teammates matter every week.",
              "No humiliation, bullying, or discrimination.",
              "Different backgrounds and personalities still belong in the same team circle.",
            ],
          },
          {
            id: "confidence",
            title: "Confidence",
            purpose: "Build trust through preparation and next-action feedback.",
            rugbyExample: "A player who can reset after a missed tackle is still ready for the next job.",
            action: "After your next mistake, name the next useful action instead of replaying the error.",
            details: [
              "Confidence changes - it is not a permanent trait.",
              "Mistakes do not define the player.",
              "Progress is not only selection.",
            ],
          },
          {
            id: "pressure",
            title: "Pressure",
            purpose: "Use a simple reset process when emotions rise.",
            rugbyExample: "After a tough phase, calm breathing and one clear action can bring you back into the game.",
            action: "Practice Pause -> Breathe -> Identify -> Choose before a stressful moment this week.",
            details: [
              "What am I feeling?",
              "What can I control?",
              "What is the next useful action?",
              "Who can support me?",
            ],
          },
          {
            id: "balance",
            title: "Rugby, School and Life",
            purpose: "Plan demanding weeks with honesty instead of pretending you can do everything perfectly.",
            rugbyExample: "Tired weeks need clearer communication and smarter preparation, not guilt.",
            action: "Look at your next busy week and identify the day where recovery matters most.",
            details: [
              "Plan demanding weeks early.",
              "Prioritize sleep where you can.",
              "Recognize overload and accept changing performance during hard periods.",
            ],
          },
          {
            id: "support",
            title: "Asking for Support",
            purpose: "Make support-seeking feel normal, clear, and safe.",
            rugbyExample: "Speaking early about stress, injury concerns, or team issues can stop small problems getting heavier.",
            action: "Name the first adult or staff member you would speak to if something felt wrong.",
            details: [
              "Speaking up is a strength.",
              "Use trusted adults and qualified professionals when needed.",
              "Rugby support should never depend on silence.",
            ],
          },
        ],
        specialFeature: {
          type: "support-map",
          title: "Donau Team Standards",
          standards: [
            "We welcome people.",
            "We listen.",
            "We challenge with respect.",
            "We protect teammates.",
            "We celebrate effort and improvement.",
            "We speak up when something is wrong.",
          ],
        },
        practicalTool: {
          type: "week-check-in",
          title: "My Week Check-In",
          intro: "This is a private reflection tool. It does not create public scores or automatic judgments.",
          prompts: [
            "I feel welcome.",
            "I feel safe.",
            "I feel connected to the team.",
            "I am managing rugby and school.",
            "I know who I can speak to.",
            "I am enjoying rugby.",
          ],
        },
        supportCard: {
          title: "Speaking up is a strength.",
          body: "If rugby, school, health, or life feels heavy, speak to a trusted adult or the right professional early. You do not need to handle every challenge alone.",
        },
        ageStageKey: "wellbeing",
        evidenceGroups: {
          "World Rugby guidance": ["wr-safeguarding", "wr-rugby-ready"],
          "IRFU guidance": ["irfu-holistic", "irfu-wellbeing"],
          "Peer-reviewed research": ["youth-athletic-development"],
          "Donau club practice": ["donau-practice"],
        },
        continueJourney: {
          nextSlide: 11,
          nextLabel: "Player Pathway",
          relatedTopic: "Use the pathway to see how support and preparation grow through each stage.",
        },
      },
      {
        id: "youth-pathway",
        slide: 11,
        iconType: "pathway",
        accent: "green",
        title: "Player Pathway",
        shortDescription: "Progression standards from U14 to senior rugby.",
        mission: "The Donau player pathway connects every stage of development from U14 through to senior rugby. Each stage has a clear purpose and a consistent coaching structure built around technical, tactical, physical, mental, and lifestyle habits.",
        intro: "Use these sections to understand what is expected at each stage and what success looks like before moving forward.",
        progressLabel: "STRUCTURE ? 68%",
        progressValue: "68%",
        progressPercent: 68,
        status: "In Build",
        tag: "Player Pathway",
        summaryTitle: "Pathway focus",
        summaryText: "Align coaches, parents, and players around what progression means at each stage - not just age or talent alone.",
        callout: "Readiness over age. Progress through every stage.",
        highlights: ["One club language", "Readiness over age", "Visible progression"],
        metrics: [
          { value: "4", label: "Pathway stages" },
          { value: "5", label: "Focus areas" },
          { value: "70:30", label: "U14 train/match" },
          { value: "50:50", label: "U16 train/match" }
        ],
        sections: [
          {
            title: "U14",
            overview: {
              stage: "Learn to Train",
              ratio: "70:30",
              focus: "Skills + Speed + Aerobic"
            },
            subtitle: "Foundation Habits ? Learn to Train ? 70:30",
            groups: [
              {
                title: "Technical",
                points: [
                  "Evasion: hand off below the armpits; swerve and dodge to avoid contact; side step off both feet; always go forward into space; change of pace",
                  "Handling: decision making around creating and preserving space; introduce switch pass and spin pass; lateral pass with both hands over 10+ metres; catching with two hands away from the chest; players should be capable of passing 10 metres; introduce lineout throw",
                  "Contact: fine tune tackling from front, side, and behind with focus on body position and timing; falling and placing the ball with long and jack knife presentations; introduce 360 presentation; pop-up pass from the ground; offload out of the tackle by pushing the ball beyond the defender; get back to feet quickly and re-join the game; build overall confidence in contact",
                  "Maul: even split ruck/maul work; ball carrier - stability and ball presentation low and in two hands; link player - body position, tower of power, set height equal to a scrum, secure and deliver ball; additional players - join correctly through the gate and understand ball transfer; defender - join through the gate, wrap ball carrier's arms and ball, then leg drive",
                  "Ruck: even split ruck/maul work; ball carrier - leg drive, then to ground, secure with good presentation or pass the ball; support players - join correctly through the gate, scrum body position, secure the ball or ruck over; tackler - release, regain feet, contest, and join correctly through the gate",
                  "Scrum: full 8-man scrum; all should participate subject to safety; all must be confident and competent; fully contested; scrum half can now pick and go; No. 8 pick up",
                  "Lineout: uncontested, no lifting; introduce basic game strategy from lineout",
                  "Backline attack: identify, create, and attack space; hold defenders with timing of pass or running line; use patterns like switch pass, loop pass, and miss pass",
                  "Re-alignment: recognise and realign on turnover or loss of possession; develop second phase attack from set plays like scrum, free pass, and kick-offs; let players begin to create a plan",
                  "Kicking and catching: grubber in 1v1 situations; punt and regain possession to gain ground; introduce attacking, defensive, and kick-off strategies"
                ]
              },
              {
                title: "Tactical",
                points: [
                  "Laws and ethics: understand the rules of 15s; take personal responsibility for behaviours and actions",
                  "Full 15s with basic tactical awareness",
                  "Begin to identify with positional role",
                  "Introduce the idea of pitch zones for game planning",
                  "Develop the idea of territory versus possession",
                  "Introduce pre-competition, competition, and post-competition routines",
                  "Go forward, including basic kicking strategy",
                  "Continuity through support and communication",
                  "Decision making: allow players to explore scenarios, get it wrong, and review",
                  "Team play: collective action in both attack and defence"
                ]
              },
              {
                title: "Physical",
                points: [
                  "Develop agility, speed, power, and endurance",
                  "Introduce triple extension",
                  "Continue co-ordination and manipulation",
                  "Teach good warm-up and cool-down habits",
                  "Place special emphasis on flexibility because of growth in bones, tendons, ligaments, and muscles",
                  "Be aware that growth and maturation are not the same for all players"
                ]
              },
              {
                title: "Mental",
                points: [
                  "Enthusiasm and commitment",
                  "Self-control",
                  "Concentration",
                  "Goal setting",
                  "Continue to develop mental habits through challenge, responsibility, and review"
                ]
              },
              {
                title: "Lifestyle & Personal",
                points: [
                  "Awareness and acceptance of pubescent development",
                  "Commitment to improve",
                  "Personal responsibility",
                  "Interpersonal skills",
                  "Good health practice",
                  "Players should begin to understand that performance depends on habits and behaviour away from the pitch"
                ]
              }
            ]
          },
          {
            title: "U16",
            overview: {
              stage: "Train to Compete",
              ratio: "50:50",
              focus: "Skill Under Pressure + Power + Decision Making"
            },
            subtitle: "Skill Acceleration ? Train to Compete ? 50:50",
            groups: [
              {
                title: "Technical",
                points: [
                  "Evasion: avoid contact when possible; swerve; full hand off; change of pace; side step",
                  "Handling: decision making around creating and preserving space; execute skills under pressure and speed",
                  "Contact: tackling skills under pressure; unit tackle - 2nd and 3rd player support in attack and defence; react to what is in front of you; ball carrier must make best decision before and during contact",
                  "Maul: full maul; ball carrier - strong base and protect the ball; support players - correct body position, strong drive, secure and deliver ball; defenders - hold up ball carrier and drive",
                  "Ruck: ball carrier - effective ball presentation; support players - protect ball carrier and secure possession; tackler - release, regain feet, and contest; create rucks to maintain continuity and increase speed of ruck; develop phase play",
                  "Scrum: attack and defence strategy; understand channels 1, 2, and 3",
                  "Lineout: full lineout with specialist thrower; decoy work; tactical understanding of lineout; use lineout as a strategic platform",
                  "Backline attack: multiple phases under match conditions; penetration through positioning, alignment, and identifying space; angle of run and timing of pass; players understand their role within a pattern; use of decoys",
                  "Backline defence: prevent penetration through the defensive line; attempt to regain possession; alignment and moving forward; react to threats; tackle and support",
                  "Kicking and catching: attack, defence, and kick-off strategies under pressure"
                ]
              },
              {
                title: "Tactical",
                points: [
                  "Laws and ethics: understand the laws of the game; take personal responsibility for behaviours and actions",
                  "Problem solving in-game",
                  "Apply tactical options to achieve the game plan",
                  "Awareness of opposition strengths and weaknesses",
                  "Ability to adjust the game plan",
                  "Add pressure to all principles of play",
                  "Players must choose the best options under pressure",
                  "Continue to develop collective understanding in attack and defence"
                ]
              },
              {
                title: "Physical",
                points: [
                  "Multi-sprint endurance",
                  "Speed",
                  "Power",
                  "Agility",
                  "Personal conditioning",
                  "Position-specific conditioning",
                  "Strength development - approximately 12 months after growth spurt slows",
                  "Introduce and supervise weight training properly"
                ]
              },
              {
                title: "Mental",
                points: [
                  "Personal preparation and warm-up routines",
                  "Controlled breathing and relaxation",
                  "Concentration",
                  "Players begin to prepare more independently and handle pressure"
                ]
              },
              {
                title: "Lifestyle & Personal",
                points: [
                  "Independent thinking",
                  "Ambition",
                  "Life balance - coping with pressure and setbacks",
                  "Awareness of leadership demands and responsibilities",
                  "Acting as role models for younger players",
                  "Players start to take ownership of their development and behaviour"
                ]
              }
            ]
          },
          {
            title: "U18",
            overview: {
              stage: "Competitive Readiness",
              ratio: "Evolving",
              focus: "Role Clarity + Intensity + Review Habits"
            },
            subtitle: "Competitive Readiness - content coming",
            points: [
              "Connect technical skill to tactical clarity and match expectations.",
              "Prepare for increased intensity, contact demands, and review habits.",
              "Expose players to senior language and accountability standards."
            ]
          },
          {
            title: "Senior",
            overview: {
              stage: "Integration Standards",
              ratio: "Performance",
              focus: "Club Language + Accountability + Continuity"
            },
            subtitle: "Integration Standards - content coming",
            points: [
              "Players arrive understanding expectations and terminology.",
              "Staff can refine rather than reteach the basics.",
              "Culture is strengthened by visible pathway continuity."
            ]
          }
        ]
      },
    ],
    playbookContext: `You are a rugby coaching assistant for Rugby Union Donau. Answer questions using ONLY the following game model knowledge. Be clear, direct, and coaching-focused. Keep answers concise. Use Donau terminology throughout.

FIELD ZONES: STREET = central field zone — best attacking zone for backs, space available, create mismatches, play fast and wide. SIDEWALK = between Street and Tramlines — if ball gets caught here, 9 and winger communicate early; tell Batman/Lion to fold or close space; if fewer than 3 defenders, play 9/15/wing/Fiji. TRAMLINES = inside 15m channels (edge of field) — limited space, force decisions, opportunity to isolate defenders.

FORWARD PODS: BATMAN = Props & Hooker (1, 2, 3). LION = Locks & No.8 (4, 5, 8). FIJI = Flankers (6, 7).

DIRECTION CALLS: BLACK = off 9 to pod. RED = off 9 to 10/12. SUNSHINE = change direction off 9. PINK = off 9 out the back to playmaker.

SCRUM DELIVERY: TONGA = 8 to 9 (standard). FIJI = through legs. RAMBO = 8 takes it himself.
SCRUM 42: RIVER = right side (8-9-15-14). LAKE = left side (hands to 11 with 10/12 skipping, or Snoop).

ATTACK CALLS: STRIKE = 9 passes across face of forwards to 1st receiver — receiver pushes flat (front-foot ball), gives ball to deeper backline. Default when ball is fast and positive. ROLL = ball passed behind forward runners — pod runs hard and stays as option if defenders don't bite; creates space for deeper 1st receiver. SNAP = switch pass. CRACKLE = dummy Snap with unders/overs. SNOOP = cut, double loop. DOGGY = circle ball. FIREFLY = blocker — both options stay available. TRIGGER = point passes behind tip to a back who transfers. MUST = override call, must get the ball. RAILS = inside ball. DARK = blind side. TURBO = pick and drive.

SLOW BALL — GOLD ZONE: KICK START = slow ball movements to speed game back up; play towards posts to give two sides; Kick-Block-Fetch-Fetch-Latch Pick to draw in 3rd defender. SPARK = simple shape option; move Batman or Fiji close to 9; early latch and drive into contact.

SCRUM STARTERS: O³ (also known as Launch Double 1) = 9 + 12 fix Opp 10 inside; 10 out the back, straightens to fix Opp 12; 11 hits seam at pace; 13 fixes Opp 13; back three hold width. C.C+ = attacking kicking option: 8 to 9, 9 to 10 behind 12, 10 kicks for 14/15; read of their 15 required. LAUNCH 41 = 9 to 14, 12 short attacking Opp 10, 10 out back; option of slider between 13/15. RHINO (Right) = 8 to 9, 12 unders to fix inside, out the back to 10, 14 as outside option. LION (Left) = 9 takes easy space left, fix Opp 10, 13 to 10, pop to 15 or straight to 11.

LINEOUT SYSTEM: Formations — 40 = 4-man, 50 = 5-man, 70/80 = full lineout. Ball delivery: 1 = off top, 2 = down and feed, 3 = drive. Alpha = same-way front. Zulu = same-way tail. CAT = throw to front man.
80/70 calls: L = 1&6 lift 4 at front. N = dummy L, 1 past to lift 6. E = 5 forward inside 3/6, then 3 lifts 5. O = dummy L, 5 up lifted by 3&8. U = dummy N, 8 lifted by 3&7. T = dummy L, 8 lifted by 5&7. I = no jump, throw directly to 4.
50 calls: L = 4 lifted at front by 1&5. O = 4 turns and lifts 5 with 8. U = dummy T, 5 back to 8, then 4&3 lift 8. T = 4 fakes forward, 5 comes back to lift 8 with 3.
SPECIAL = lineout set play (refer to diagram).

EXITS — GOAL: ball in touch past own 40m, OR contestable kick past 40m, OR long kick bouncing over halfway. DRIVER = long kick. BINGO = contestable kick — regain possession inside 40m. BANANA = box kick (from lineout: 72 Banana, down and feed to 9 then kick). ZERO = bail-out under pressure. RAMP 1 LEFT = Phase 1: 9 to 8, 11/12/8/7 to breakdown, 10 in pocket; Phase 2: Fiji around corner or block right; Phase 3: 9 to 15 — kick driver/bingo or run. RAMP 2 RIGHT = Phase 1: 9 to 8, 14/12/8/7 to breakdown, 10 in pocket; Phase 2: Fiji stays right; 9 back to 10 to kick out or shift left.

DEFENCE PRINCIPLES: Toughness, workrate, relentless discipline. Presence + spacing + inside ball = hunt hard and be concrete. On ball = accelerate into the tackle. Outside ball = stay square. Violence at contact, bodies in front, repeat.
AXE = 1st tackler — low chop, dominant tackle, roll away to clear ruck. HUNT = inside defender — attack ball if space is there, fight to slow if bodies are in the way. DOUBLE HUNT = 2nd inside defender — reads breakdown, counter-rucks or folds. COP = outside Axe — holds width, organises fold, 2nd tackler if overs are run.
DEFENSIVE CALLS: READY/UP = line call by No.1 defender. HAMMER = linespeed call (good numbers). HOVER = hold and read (poor numbers). STORM = Red Zone aggressive up-and-in change-up — 100% commitment, D10 covers holes. ICE = counter ruck. SPACE = get past the ball. STEAL = pilfer.

RHS SCRUM DEFENCE — GREEN: 9 closes shortside or goes neutral; 2-fullback mentality; 14/15/11 pendulum working; kick return: open winger connects to 15 to 13.
RHS SCRUM DEFENCE — ORANGE: if attacking blind winger aligns between 9 and 10, D9 matches; drags 15 across; open winger drops to pocket.
RHS SCRUM DEFENCE — RED: blind winger holds shortside, moves quickly on pass. STORM option available.
LHS SCRUM DEFENCE: backs align outside shoulder of attacker, push into next channel. D9=No.8, D10=1st, D12=2nd, D13=3rd, D14=2nd last, D15=last.
CENTRE FIELD SCRUM DEFENCE: 10/12 defend together on side with highest numbers; 9 pressures/takes 10; 13 works with 7 for connection.`,
  };
})();
