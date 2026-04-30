(function () {
  const base = window.DONAU_ASSET_BASE || "assets/donau/";
  const asset = (path) => `${base}${path}`;

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
      { slide: 8, group: "Development", shortLabel: "Pathway", title: "Player Pathway" },
      { slide: 9, group: "Development", shortLabel: "Fuel", title: "Fuel & Recovery" },
      { slide: 10, group: "Development", shortLabel: "Athletic", title: "Athletic Development" },
      { slide: 11, group: "Development", shortLabel: "Wellbeing", title: "Player Wellbeing" },
    ],
    developmentModules: [
      {
        id: "youth-pathway",
        slide: 8,
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
      {
        id: "nutrition",
        slide: 9,
        iconType: "fuel",
        accent: "gold",
        title: "Fuel & Recovery",
        shortDescription: "Daily habits that support training, recovery, and matchday.",
        mission: "Build simple fuel and recovery habits that improve availability, consistency, and matchday readiness across the club.",
        intro: "Nutrition inside a club environment should be realistic and repeatable. The objective is helping players make better daily decisions that improve availability and recovery.",
        progressLabel: "RESOURCES ? 52%",
        progressValue: "52%",
        progressPercent: 52,
        status: "Available",
        tag: "Fuel & Habits",
        summaryTitle: "Key principle",
        summaryText: "Better consistency beats occasional extremes. Players improve when useful habits fit real life around school, work, and rugby.",
        callout: "Daily discipline drives performance long before kickoff.",
        highlights: ["Daily habits", "Matchday basics", "Recovery support"],
        metrics: [
          { value: "52%", label: "Resources live" },
          { value: "3", label: "Priority areas" }
        ],
        sections: [
          {
            title: "Daily Habits",
            subtitle: "Fuel the training week",
            points: [
              "Eat regularly enough to support the weekly load.",
              "Hydrate consistently, not only at training.",
              "Build around quality basics before supplements."
            ]
          },
          {
            title: "Matchday",
            subtitle: "Known and repeatable",
            points: [
              "Arrive fueled rather than trying to catch up late.",
              "Keep pre-match food simple, known, and easy to digest.",
              "Plan post-match food before kickoff."
            ]
          },
          {
            title: "Recovery",
            subtitle: "Support availability",
            points: [
              "Refuel soon after hard sessions with simple options.",
              "Prioritize fluids, carbs, and protein after contact load.",
              "Use food to improve training availability through the week."
            ]
          }
        ]
      },
      {
        id: "strength-conditioning",
        slide: 10,
        iconType: "athletic",
        accent: "silver",
        title: "Athletic Development",
        shortDescription: "Movement quality, durability, and rugby readiness.",
        mission: "Develop athletes who move well, handle load better, and stay more available for rugby across every stage of the club.",
        intro: "Strength and conditioning should improve how well players move, how consistently they can train, and how ready they are for rugby demands over time.",
        progressLabel: "FRAMEWORK ? 61%",
        progressValue: "61%",
        progressPercent: 61,
        status: "Active",
        tag: "Athletic Framework",
        summaryTitle: "Coaching lens",
        summaryText: "The key question is not whether players are tired after training. It is whether they are becoming more robust, more skillful movers, and more available to perform.",
        callout: "Movement quality, durability, and readiness should rise together.",
        highlights: ["Movement quality", "Durability", "Rugby readiness"],
        metrics: [
          { value: "61%", label: "Framework live" },
          { value: "Active", label: "Module state" }
        ],
        sections: [
          {
            title: "Movement Quality",
            subtitle: "Positions before output",
            points: [
              "Own positions and control before chasing output.",
              "Develop balance, trunk strength, landing, and deceleration habits.",
              "Use progressions players can understand and repeat."
            ]
          },
          {
            title: "Athletic Development",
            subtitle: "Broad physical base",
            points: [
              "Speed, force, and repeatability should grow together.",
              "Youth players need broad development, not narrow specialization.",
              "Senior players need enough robustness to train well consistently."
            ]
          },
          {
            title: "Rugby Readiness",
            subtitle: "Transfer to the game",
            points: [
              "Prepare for contact demands and repeated high-effort actions.",
              "Use gym and field work to support on-pitch intent and availability.",
              "Track readiness in ways coaches can actually use."
            ]
          }
        ]
      },
      {
        id: "wellbeing",
        slide: 11,
        iconType: "wellbeing",
        accent: "muted-green",
        title: "Player Wellbeing",
        shortDescription: "Sleep, mindset, and recovery habits that sustain performance.",
        mission: "Support players with the off-pitch habits that protect energy, consistency, and balance through a demanding rugby season.",
        intro: "Wellbeing is part of performance. Sleep, life balance, and recovery habits directly affect availability, decision-making, and the standard a player can maintain.",
        progressLabel: "GUIDANCE ? 49%",
        progressValue: "49%",
        progressPercent: 49,
        status: "Available",
        tag: "Recovery & Balance",
        summaryTitle: "Club message",
        summaryText: "A strong club environment helps players perform better by taking their off-pitch reality seriously. Better people support better rugby.",
        callout: "Better people build better rugby when recovery and balance are part of the standard.",
        highlights: ["Sleep", "Recovery", "Mindset", "Balance"],
        metrics: [
          { value: "49%", label: "Guidance live" },
          { value: "4", label: "Support lanes" }
        ],
        sections: [
          {
            title: "Sleep",
            subtitle: "Night-before performance",
            points: [
              "Good sleep habits are one of the biggest performance multipliers.",
              "Players need routines that work around school, work, and travel.",
              "Recovery starts the night before, not only after sessions."
            ]
          },
          {
            title: "Recovery",
            subtitle: "Reset after load",
            points: [
              "Use simple repeatable practices after heavy weeks.",
              "Normalize early communication about soreness and load.",
              "Help players understand when to push and when to reset."
            ]
          },
          {
            title: "Mindset",
            subtitle: "Ownership under pressure",
            points: [
              "Promote ownership, honesty, and emotional steadiness.",
              "Use feedback to build clarity and confidence, not fear.",
              "Reinforce that consistency comes from habits under pressure."
            ]
          },
          {
            title: "Balance",
            subtitle: "Life rhythm matters",
            points: [
              "Rugby should fit a sustainable life rhythm.",
              "Support players across school, work, family, and club demands.",
              "Protect long-term engagement by caring about the whole athlete."
            ]
          }
        ]
      }
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
