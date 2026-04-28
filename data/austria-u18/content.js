(function () {
  window.AUSTRIA_U18_DATA = {
    workspaceSections: [
      { slide: 1, group: "Program Core", shortLabel: "Cover",     title: "Program Cover" },
      { slide: 2, group: "Program Core", shortLabel: "Model",     title: "Game Model" },
      { slide: 3, group: "Program Core", shortLabel: "Attack",    title: "Attack System" },
      { slide: 4, group: "Program Core", shortLabel: "Defence",   title: "Defensive System" },
      { slide: 5, group: "Program Core", shortLabel: "Set Piece", title: "Set Piece" },
      { slide: 6, group: "Campaign Layer", shortLabel: "Units",     title: "Roles & Units" },
      { slide: 7, group: "Campaign Layer", shortLabel: "Analysis",  title: "Analysis Hub" },
      { slide: 8, group: "Campaign Layer", shortLabel: "Assistant", title: "AI Playbook Assistant" }
    ],

    // ── ATTACK SIDEBAR ──────────────────────────────────────────────────
    attackSidebar: {
      fieldAreas: [
        {
          name: "A — Clean Exit",
          short: "Own half / under pressure",
          points: [
            "Win territory first. Touch and out.",
            "Minimal phases — exit clean before building.",
            "Platform quality over play ambition in this zone."
          ]
        },
        {
          name: "B — Kick to Contest",
          short: "Own half / momentum building",
          points: [
            "Kick intelligently to pressure territory.",
            "Chase connected and organised.",
            "Only if the platform and momentum give you the right picture."
          ]
        },
        {
          name: "C — Starter Plays",
          short: "Mid-field / building to score",
          points: [
            "Run starter plays with layered structure.",
            "Two genuine avenues of attack.",
            "Maintain width to keep the defence honest."
          ]
        },
        {
          name: "D — Earn the Width",
          short: "Opposition territory / scoring range",
          points: [
            "Vary the forward attack first — earn the right to go wide.",
            "Play for points. Be decisive.",
            "Use Rhino, Magic, Boss to fix before releasing backs."
          ]
        }
      ],
      directionCalls: [
        { key: "BLACK", value: "Pass to forward off 9" },
        { key: "RED",   value: "Pass to forward off 10" }
      ],
      pods: []
    },

    // ── ATTACK TABS ─────────────────────────────────────────────────────
    attackData: {
      setpiece: [
        {
          name: "5 Man",
          type: "Lineout Formation",
          detail: [
            "Compact shape. Best used when TEMPO is on and the defence is late arriving.",
            "Quick-ball picture — 4 (Forward) or 3 (Back) called at the throw.",
            "Creates immediate launch platform without contest build-up."
          ]
        },
        {
          name: "5 + 1",
          type: "Lineout Formation",
          detail: [
            "5 players in the lineout, one forward floats outside.",
            "Floating forward can enter the maul or support a pod play.",
            "Gives an extra option without changing the throw picture."
          ]
        },
        {
          name: "6 Man",
          type: "Lineout Formation",
          detail: [
            "Primary attacking formation. Used mid-field and inside own 40m.",
            "Good platform for maul entry or back-of-lineout launch.",
            "4 or 3 delivery code determines whether the forward or back receives."
          ]
        },
        {
          name: "6 + 1",
          type: "Lineout Formation",
          detail: [
            "6 in the lineout with a floating forward.",
            "Extra body for maul entry or short-side defence bind.",
            "Used when maul threat needs to look real before the ball moves."
          ]
        },
        {
          name: "Full",
          type: "Lineout Formation",
          detail: [
            "Full lineout. Maximum forward presence.",
            "Used inside the 22m for drive plays or high-pressure launch.",
            "2 & 2 pod structure can apply to entry roles."
          ]
        }
      ],
      phase: [
        {
          name: "Rhino",
          type: "Phase Play",
          detail: [
            "Pick and go.",
            "Forward takes the ball from the base and drives hard into contact.",
            "Best used when the defence is still folding or numbers are short."
          ]
        },
        {
          name: "Magic",
          type: "Phase Play",
          detail: [
            "Forwards act as dummy runners. Play released to backs.",
            "Forwards show carry intent to fix defensive attention.",
            "Ball moves through or behind them to the backs line."
          ]
        },
        {
          name: "Boss",
          type: "Phase Play",
          detail: [
            "Pull pass from a forward to the playmaker — out the back.",
            "Forward fixes the inside defenders. Playmaker arrives late with space.",
            "Effective when defence over-commits to the carry picture."
          ]
        },
        {
          name: "Tips",
          type: "Phase Play",
          detail: [
            "Short pass close to contact.",
            "Attack the shoulder of the defender just before or after contact.",
            "Requires tight timing and early connection from support."
          ]
        },
        {
          name: "Fiji",
          type: "Phase Play",
          detail: [
            "Change direction — snap the ball back against the grain.",
            "Attack the blind side of the defence before they can reset.",
            "Requires clear communication and a sharp support runner arriving from depth."
          ]
        },
        {
          name: "England",
          type: "Phase Play · Sequence",
          detail: [
            "5-man lineout launch. Forwards carry same direction to fix the defence.",
            "Then Magic: forwards become dummy runners, ball releases to backs.",
            "Sets up the backs line late after a forward-heavy picture has been shown."
          ]
        },
        {
          name: "Wales",
          type: "Phase Play · Sequence",
          detail: [
            "Two forward carries in the middle — pod shape, same direction.",
            "Then play back inside off the second carry.",
            "Forces the defence to commit before the ball reverses."
          ]
        }
      ],
      exits: [
        {
          name: "Tonic",
          type: "Kicking Series · Box Kick",
          detail: [
            "Box kick system. Three variants — Tonic 1, 2, or 3.",
            "Variant determines chase alignment and back-field cover.",
            "Used to contest possession from the box kick position."
          ]
        },
        {
          name: "Whiskey",
          type: "Kicking Series · Exit Kick",
          detail: [
            "Exit kick system. Three variants — Whiskey 1, 2, or 3.",
            "Variant determines kick type, chase line, and cover alignment.",
            "Used to exit own territory and win field position."
          ]
        },
        {
          name: "Vodka",
          type: "Kicking Series · Chip & Regather",
          detail: [
            "Chip and regather system. Three variants — Vodka 1, 2, or 3.",
            "Variant determines who chips, the target area, and regather support.",
            "Used to attack space behind the defensive line."
          ]
        }
      ],
      calls: [
        { name: "BLACK",   type: "Direction Call",    detail: ["Pass to forward off 9."] },
        { name: "RED",     type: "Direction Call",    detail: ["Pass to forward off 10."] },
        { name: "Rhino",   type: "Phase Play",        detail: ["Pick and go."] },
        { name: "Magic",   type: "Phase Play",        detail: ["Forwards dummy-run. Play released to backs."] },
        { name: "Boss",    type: "Phase Play",        detail: ["Pull pass from forward to playmaker out the back."] },
        { name: "Tips",    type: "Phase Play",        detail: ["Short pass close to contact."] },
        { name: "Fiji",    type: "Phase Play",        detail: ["Change direction — snap back against the grain."] },
        { name: "England", type: "Phase Play · Sequence", detail: ["5-man lineout launch into Magic sequence."] },
        { name: "Wales",   type: "Phase Play · Sequence", detail: ["Two forward pod carries, then play back inside."] },
        { name: "2 & 2",   type: "Forward Structure", detail: ["Pods of 2 forwards. Inside bind active. Outside pre-binds on contact."] },
        { name: "Tonic",   type: "Kicking · Box Kick",       detail: ["Box kick system. Three variants (1 / 2 / 3)."] },
        { name: "Whiskey", type: "Kicking · Exit Kick",      detail: ["Exit kick system. Three variants (1 / 2 / 3)."] },
        { name: "Vodka",   type: "Kicking · Chip & Regather",detail: ["Chip and regather system. Three variants (1 / 2 / 3)."] },
        { name: "A", type: "Pitch Principle · Attack", detail: ["Clean exit. Touch. Minimal phases."] },
        { name: "B", type: "Pitch Principle · Attack", detail: ["Kick to contest if momentum allows."] },
        { name: "C", type: "Pitch Principle · Attack", detail: ["Starter plays. Two avenues of attack. Hold width."] },
        { name: "D", type: "Pitch Principle · Attack", detail: ["Vary forward attack. Earn the right to go wide. Play for points."] }
      ]
    },

    // ── DEFENCE ─────────────────────────────────────────────────────────
    defenceRoles: [
      {
        name: "INSIDE CHOP",
        desc: "Low dominant tackle inside the ball carrier. Cut space and win the shoulder."
      },
      {
        name: "OUTSIDE TOP",
        desc: "High control tackle outside the ball carrier. Contain, slow ball speed."
      },
      {
        name: "GUARD B",
        desc: "First defender next to the ruck. Holds inside gate. Scans and contests if the picture is live."
      },
      {
        name: "GUARD C",
        desc: "Second defender next to the ruck. Scans a beat later. Contest if clean — otherwise Back in game."
      },
      {
        name: "BACK IN GAME",
        desc: "Reload from the breakdown back into the defensive line. Connection priority over contest attempt."
      }
    ],

    defenceCalls: [
      { name: "WIN THE RACE",  action: "Line speed standard — arrive at the tackle picture first, connected." },
      { name: "READY / UP",    action: "Primary line call. Edge is set and connected before the ball is live." },
      { name: "ICE",           action: "Counter-ruck trigger." },
      { name: "RED",           action: "Emergency scramble or linebreak response." },
      { name: "GUARD B",       action: "First defender locks inside gate and reads the next action." },
      { name: "GUARD C",       action: "Second defender scans. Contest if clean, Back in game if not." },
      { name: "BACK IN GAME",  action: "Clear the breakdown — reload into the line immediately." }
    ],

    defData: {
      rhs: {
        green: {
          title: "Principle B — Organised Line",
          color: "g",
          points: [
            "Organised line, connected inside-out.",
            "Guard B holds inside gate and scans for contest opportunity.",
            "Back three keep width and solve kick-return picture early."
          ]
        },
        orange: {
          title: "Principle C — Guard Scanning",
          color: "o",
          points: [
            "Guard B and C scan — contest if the picture is live.",
            "If no clean contest: Back in game immediately.",
            "Line must not wait — Win The Race applies to the fold too."
          ]
        },
        red: {
          title: "Principle A — Blitz",
          color: "r",
          points: [
            "Line speed. Stay connected. No ruck over-commit.",
            "Inside CHOP dominates first contact. Outside TOP holds width.",
            "ICE trigger available when the ball picture slows."
          ]
        }
      },
      lhs: {
        green: {
          title: "Principle B — Organised Line",
          color: "g",
          points: [
            "Organised line from the inside out.",
            "Guard C holds second gate and reads the next action.",
            "Midfield stays square and connected before pushing up."
          ]
        },
        orange: {
          title: "Principle C — Guard Scanning",
          color: "o",
          points: [
            "Guard B and C scanning. Contest if available.",
            "Back in game takes priority over a loose pilfer.",
            "Short-side picture must be read before the ball is live."
          ]
        },
        red: {
          title: "Principle A — Blitz",
          color: "r",
          points: [
            "Maximum line speed, connected across the front.",
            "Win The Race at this picture — no slow connections.",
            "15 solves kick space. ICE remains live."
          ]
        }
      },
      cfs: {
        green: {
          title: "Principle B / D — Organised & Disciplined",
          color: "g",
          points: [
            "Organised line with width and discipline.",
            "Guard B and C scan the breakdown before committing.",
            "Back three keep pendulum alive and hold width."
          ]
        },
        orange: {
          title: "Principle C — Guard Scanning",
          color: "o",
          points: [
            "Guard B and C contest if clean — otherwise Back in game fast.",
            "Line cannot afford a soft seam between 10 and 12.",
            "Win The Race: fold speed matters as much as line speed."
          ]
        },
        red: {
          title: "Principle A / D — Blitz or Pressure",
          color: "r",
          points: [
            "Principle A Blitz available from centre field when numbers and line speed are right.",
            "Inside CHOP and Outside TOP organised before the ball is live.",
            "Apply kick pressure when the platform allows — Principle D."
          ]
        }
      }
    },

    // ── SET PIECE ────────────────────────────────────────────────────────
    setPiece: {
      metrics: [
        { value: "90%", label: "Own lineout" },
        { value: "100%", label: "Own scrum" },
        { value: "85%", label: "Launch quality" },
        { value: "70%", label: "Opposition disrupted" }
      ],
      codes: [
        { key: "40", desc: "4-man lineout shape" },
        { key: "50", desc: "5-man lineout shape" },
        { key: "70", desc: "Full lineout inside own 40m" },
        { key: "80", desc: "Full lineout outside own 40m" },
        { key: "1", desc: "Off the top delivery" },
        { key: "2", desc: "Down and feed" },
        { key: "3", desc: "Drive picture" }
      ],
      notes: [
        { title: "Clarity First", text: "Players should know the trigger, destination, and next action before arrival." },
        { title: "Clean Picture", text: "Austria values launch quality over call volume." },
        { title: "One Contest Layer", text: "Lineout, scrum, and maul should all feed the same territorial plan." }
      ],
      tabs: {
        lineout: {
          groups: [
            {
              title: "Fundamentals",
              items: [
                { name: "Throw", sub: "Core skill", detail: "Two types: To target — accurate direct delivery to the jumper. To space — throw to an area for the jumper to attack." },
                { name: "Jump", sub: "Core skill", detail: "Three techniques: Split — legs apart for stability and power. Front foot — weight forward, drives into the lift. Back foot — weight back, used for tail and counter jumps." },
                { name: "Lift", sub: "Core skill", detail: "Two positions: Front lift — lifter at the front of the jumper, drives upward from the hips. Back lift — lifter at the rear, supports and extends the jump." },
                { name: "Delivery", sub: "Core skill", detail: "Three options: Off the top — clean catch and immediate transfer to 9. Down and pop/drive — controlled return to ground for maul or pop pass. Shift — ball moved sideways in the air before delivery." }
              ]
            },
            {
              title: "Attacking Principles",
              items: [
                { name: "Win the Ball", sub: "Non-negotiable", detail: "Own throw is the foundation. Every formation and call exists to secure clean possession first." },
                { name: "SET — Same Every Time", sub: "Consistency standard", detail: "Consistency in body shape, timing, and execution. The system only works when every player repeats the same picture every time." },
                { name: "1 New Item Per Week", sub: "Build rate", detail: "Install the system progressively. Add one new call or formation per week so the squad can own each element before the next is added." },
                { name: "Numbers Low on Own Goal Line", sub: "Field position principle", detail: "Use fewer players in the lineout near your own line and build outward as field position improves. Reduces risk exposure in dangerous territory." },
                { name: "Build Around the Hooker", sub: "System anchor", detail: "The hooker's accuracy and decision-making are the system's foundation. All formations and calls must account for what the hooker can execute consistently." }
              ]
            },
            {
              title: "SPARK System",
              items: [
                { name: "SPARK", sub: "Keyword — jumper positions", detail: "SPARK is the positional keyword. Each letter maps to a jumper position: S = J1, P = J2, A = J3, R = J4, K = J5. Calling SPARK identifies which player jumps without naming them directly." },
                { name: "S — J1", sub: "Jumper position 1", detail: "First jumper position. Typically the front of the lineout. S is called to identify J1 as the target." },
                { name: "P — J2", sub: "Jumper position 2 · 5-man caller", detail: "Second jumper position. P is the caller in the 5-man lineout. P is called to identify J2 as the target." },
                { name: "A — J3", sub: "Jumper position 3", detail: "Third jumper position — usually mid-lineout. A is called to identify J3 as the target." },
                { name: "R — J4", sub: "Jumper position 4", detail: "Fourth jumper position. R is called to identify J4 as the target." },
                { name: "K — J5", sub: "Jumper position 5", detail: "Fifth jumper position. Typically near the tail of the lineout. K is called to identify J5 as the target." }
              ]
            },
            {
              title: "5 Man Lineout — Call 50",
              items: [
                { name: "Default Shape — Spread", sub: "Call: 50 · J2 is caller", detail: "Formation: FL — S — P — A — BL. Evenly spread across the lineout. J2 (P) is the caller. Pre-call attaches to option 1. This is the base shape from which Squeeze Nod and Squeeze Black are triggered." },
                { name: "Squeeze Nod", sub: "P calls squeeze", detail: "P calls squeeze and nods to the hooker, who throws a tempo ball directly to P. Shape compresses to FL — SPA — BL. Players squeeze together to create a compact drive picture around P." },
                { name: "Squeeze Black", sub: "Squeeze then S jumps", detail: "Squeeze is called. S takes one step forward and jumps, lifted by FL and P. Shape: FL — SP — A — BL. The squeeze draws defenders in before S attacks the front of the lineout." }
              ]
            },
            {
              title: "80/70 Formation Calls",
              items: [
                { name: "L — Alpha", sub: "Trigger 4 · Lifters 1, 6", detail: "Front lift. 1 and 6 lift 4 at the front of the lineout. Alpha variant: 5 arrives last and rushes forward to support or enter the maul picture." },
                { name: "N — Dummy L", sub: "Trigger 4", detail: "Dummy front move. 1 goes past the front position and lifts 6 instead. Creates a false front picture before the actual jump lands." },
                { name: "E — Forward Move", sub: "Trigger 4 · Lifters 1, 6, 3", detail: "Dummy L first. 5 moves forward inside 3 and 6 by one step, then 3 lifts 5. The dummy at the front pulls the defence before the real jump goes through the middle." },
                { name: "O — Back Move", sub: "Trigger 4 · Lifters 6, 5, 3", detail: "Dummy L first. 5 goes one step forward then is lifted by 3 and 8 in the back zone. The front dummy creates the space for 5 to go back." },
                { name: "U — Counter", sub: "Trigger 4 · Lifters 3, 8, 7", detail: "Dummy N first. 5 moves back to 8. Then 8 and 7 slide past 5 toward 3. 3 and 7 lift 8. The crossing movement makes the defence track multiple bodies before the real jump lands." },
                { name: "T — Tail", sub: "Trigger 4 · Lifters 5, 8, 7", detail: "Dummy L first. 5 moves back to 8. 8 is lifted by 5 and 7 at the tail. Designed to attack the tail of the lineout after showing a front picture." },
                { name: "I — No Jump", sub: "Trigger 2 · Lifter 4", detail: "No jump — direct throw to 4 without a lift. Quick option when the defence is not set or when a simple contest ball is preferred." },
                { name: "CAT — Front", sub: "All formations · Override", detail: "Throw to the front man when space is clear. CAT is available from any formation as an override when the front of the lineout is uncontested." }
              ]
            },
            {
              title: "50 & 40 Man Formations",
              items: [
                { name: "L — Front Lift", sub: "50 Formation · Trigger 4 · Lifters 1, 4, 5", detail: "4 is lifted at the front by 1 and 5. Alpha applies: 5 arrives last and rushes forward. Same L structure as the 80/70 call adapted for the 5-man shape." },
                { name: "O — Back Lift", sub: "50 Formation · Trigger 8 · Lifters 4, 5, 8", detail: "4 turns and lifts 5 with 8 in the back zone. Zulu variant: 5 arrives last and rushes back. The front trigger pulls attention before the back lift executes." },
                { name: "U — Counter", sub: "50 Formation · Trigger 5 · Lifters 4, 8, 3", detail: "Dummy T first. 5 moves back to 8. 8 and 3 slide past 5 to 4. 4 and 3 lift 8. Crossing movement designed to beat a mirroring defence." },
                { name: "T — Tail", sub: "50 Formation · Trigger 4 · Lifters 5, 8, 3", detail: "4 fakes forward to 1. At the same time 5 comes back to lift 8 with 3. The fake forward freezes the front defender before the ball goes to the tail." },
                { name: "L — 40 Front", sub: "40 Formation · Trigger 4 · Lifters 1, 4, 5", detail: "Same as L above, adapted for the 4-man lineout. Alpha and Zulu variants both apply." },
                { name: "E — Dummy O", sub: "40 Formation · Trigger 4 · Lifters 1, 5, 8", detail: "Dummy O movement shown. As 4 comes back, 5 and 8 move to support 1 at the front. Shows a back picture before attacking the front." },
                { name: "O — 40 Back", sub: "40 Formation · Trigger 2 · Lifters 4, 5, 8", detail: "4 and 8 lift 5 at the back of the 4-man lineout. Direct back lift with minimum movement. Used when field position or time requires a simple back option." }
              ]
            },
            {
              title: "Calling Structure",
              items: [
                { name: "Pre-Call", sub: "On the way to the lineout", detail: "The call is made while walking to the lineout. Every player must know the shape and their role before they take their position. No adjustments once set." },
                { name: "Trigger Activation", sub: "Front prop to hooker", detail: "The front prop passes the call to the hooker on the way to the lineout. The hooker confirms receipt. The pre-call is activated by the trigger word at the lineout." },
                { name: "Alpha / Zulu Override", sub: "Backup option", detail: "If the standard pre-call cannot be used — opposition reads the shape, time pressure, or personnel issue — Alpha (front variant) or Zulu (back variant) is called as the override." },
                { name: "Execution Keys", sub: "Non-negotiables", detail: "Patience with triggers — do not jump before the trigger word. Clear gaps — spacing must be correct before the throw. Effective delivery — hooker accuracy is not negotiable. Speed of lift — lifters must be under the jumper before the ball arrives." }
              ]
            },
            {
              title: "Lineout Maul Roles",
              items: [
                { name: "Lifters", sub: "Entry role", detail: "Leg hook to secure the jumper on landing. Survive the initial defensive drive — do not release under pressure." },
                { name: "Wedge", sub: "Support drive", detail: "Arrive at the same time as the ball. Heads inside the ball carrier. Drive forward as a unit — not as an individual." },
                { name: "Transfer", sub: "Ball movement", detail: "Gets momentum on the rip. Once the ball is moving, the transfer player becomes another wedge in the drive." },
                { name: "Gun", sub: "Ball carrier", detail: "Makes the ball visible to the referee at all times. Stays patient — does not release or move until the maul momentum is established." },
                { name: "Spare", sub: "Reads the picture", detail: "Does not attach to the nearest body. Reads where the best next job is — edge support, breakdown seal, or additional drive angle." }
              ]
            }
          ]
        },
        scrum: {
          groups: [
            {
              title: "Platform Standards",
              items: [
                { name: "Own Feed", sub: "Non-negotiable", detail: "Stable, square, and patient until delivery is live." },
                { name: "Pressure Picture", sub: "Defensive intent", detail: "Opposition should feel contest even when turnover is not immediate." },
                { name: "Launch Quality", sub: "Backline connection", detail: "9, 10, and edge finishers must all see the same picture." }
              ]
            },
            {
              title: "Launch Types",
              items: [
                { name: "Crest 12", sub: "Midfield strike", detail: "Fix inside defenders and release second layer." },
                { name: "Summit", sub: "Pressure release", detail: "Show carry, play behind, finish at edge." },
                { name: "Hammer Exit", sub: "Territory first", detail: "Calm platform into long clearance when needed." }
              ]
            }
          ]
        },
        maul: {
          groups: [
            {
              title: "Maul Roles",
              items: [
                { name: "Lifters", sub: "Entry role", detail: "Leg hook to secure the jumper on landing. Survive the initial defensive drive — do not release under pressure." },
                { name: "Wedge", sub: "Support drive", detail: "Arrive at the same time as the ball. Heads inside the ball carrier. Drive forward as a unit — not as an individual." },
                { name: "Transfer", sub: "Ball movement", detail: "Gets momentum on the rip. Once the ball is moving, the transfer player becomes another wedge in the drive." },
                { name: "Gun", sub: "Ball carrier", detail: "Makes the ball visible to the referee at all times. Stays patient — does not release or move until the maul momentum is established." },
                { name: "Spare", sub: "Reads the picture", detail: "Does not attach to the nearest body. Reads where the best next job is — edge support, breakdown seal, or additional drive angle." }
              ]
            },
            {
              title: "Maul Non-Negotiables",
              items: [
                { name: "Height", sub: "Body shape", detail: "Win the race under the chest line and stay connected." },
                { name: "Patience", sub: "Decision-making", detail: "Do not rush the transfer before the picture is earned." },
                { name: "Exit", sub: "Next action", detail: "Know whether the maul is for score, pressure, or launch." }
              ]
            },
            {
              title: "Lineout Defence",
              items: [
                { name: "Mirror", sub: "Defence system", detail: "Match the opposition lineout shape — each defender mirrors their opposite number. Designed to limit movement and close down throwing channels." },
                { name: "Pod", sub: "Defence system", detail: "Group defenders in pods rather than spread across the lineout. Creates contest pressure in zones rather than man-for-man. Effective against complex movement calls." },
                { name: "Hinge", sub: "Defence system", detail: "Defenders hinge off the lineout edge to cover both the lineout contest and the defensive line. Used when the opposition is likely to exit the lineout quickly." }
              ]
            }
          ]
        }
      }
    },

    // ── UNITS ────────────────────────────────────────────────────────────
    units: [
      {
        title: "Back Three",
        subtitle: "15 · 11 · 14",
        attack: [
          "Read and decide edge-zone finish in Principle C and D territory.",
          "Stay alive for chip regather (Vodka series) and kick-return."
        ],
        defence: [
          "Principle B and A: hold width, connect to line speed.",
          "Protect kick space before chase space."
        ],
        setPiece: [
          "Connect to exit plan immediately after set piece.",
          "Hold width without disconnecting from the chase picture."
        ]
      },
      {
        title: "Inside Backs",
        subtitle: "9 · 10 · 12 · 13",
        attack: [
          "Call BLACK or RED to direct the forward picture before the ball leaves source.",
          "Two avenues of attack — forward and wide — must both look live."
        ],
        defence: [
          "Drive line-speed language. Win The Race applies to the whole line.",
          "Close the gate inside-out. Guard B and C stay connected."
        ],
        setPiece: [
          "Own launch clarity from scrum and lineout.",
          "Call the next play before contact."
        ]
      },
      {
        title: "Tight Five",
        subtitle: "1 · 2 · 3 · 4 · 5",
        attack: [
          "Execute Rhino, Tips, and 2&2 pod shape with accuracy.",
          "Be the dummy runners in Magic — make the fix look real."
        ],
        defence: [
          "Inside CHOP at first contact near the source.",
          "Protect fold integrity. Back in game on second phase."
        ],
        setPiece: [
          "Deliver own lineout at national standard — TEMPO decision is theirs.",
          "2&2 entry in the maul. Square, same time, same height."
        ]
      },
      {
        title: "Loose Forwards",
        subtitle: "6 · 7 · 8",
        attack: [
          "Boss and Fiji plays live here — carry and release, or snap back.",
          "Link inside forward pressure to outside speed."
        ],
        defence: [
          "Guard B and C roles — own the ruck contest decision.",
          "Back in game is the default when contest is not clean."
        ],
        setPiece: [
          "England and Wales plays start here — carry same direction, then release.",
          "Support lineout and maul movement and hold launch alive after first action."
        ]
      },
      {
        title: "Halfback Spine",
        subtitle: "9 · 10 · 15",
        attack: [
          "Call BLACK (off 9) or RED (off 10) early. The forward picture must be set.",
          "Manage kicking system — Tonic, Whiskey, or Vodka called with intent."
        ],
        defence: [
          "Align line, back-field, and kick response fast.",
          "Own the Win The Race standard — language and pace."
        ],
        setPiece: [
          "Translate the platform into the correct contest picture.",
          "Protect exit discipline — Principle A and B decisions start here."
        ]
      },
      {
        title: "Finishers",
        subtitle: "Bench Impact",
        attack: [
          "Lift tempo without losing play clarity.",
          "Add accuracy to the final quarter — Rhino and Boss especially."
        ],
        defence: [
          "Bring fresh line speed and fold urgency.",
          "Close the game with Win The Race discipline."
        ],
        setPiece: [
          "Hold TEMPO read standards when fatigue rises.",
          "Protect final launch pictures and lineout quality."
        ]
      }
    ],

    // ── ANALYSIS HUB ────────────────────────────────────────────────────
    analysis: {
      cards: [
        {
          title: "Opponent Prep",
          shortDescription: "Threats, tendencies, and the likely pressure points for the next campaign fixture.",
          progressLabel: "LIVE FILE",
          progressValue: "Week 1",
          progressPercent: 64,
          status: "Active",
          accent: "red",
          icon: "OP",
          points: ["Kick-return threats", "Preferred launch areas", "Weak shoulders to target"]
        },
        {
          title: "Film Review",
          shortDescription: "Shared clips and review prompts for units and selection conversations.",
          progressLabel: "CLIP BANK",
          progressValue: "18 clips",
          progressPercent: 52,
          status: "Available",
          accent: "silver",
          icon: "FR",
          points: ["Positive examples", "Fix-it moments", "Unit review prompts"]
        },
        {
          title: "Stats & KPIs",
          shortDescription: "Campaign measures for set piece, territory, collisions, and discipline profile.",
          progressLabel: "TRACKING",
          progressValue: "9 KPIs",
          progressPercent: 58,
          status: "Active",
          accent: "gold",
          icon: "KP",
          points: ["Launch quality", "Territory wins", "Penalty profile"]
        },
        {
          title: "Match Notes",
          shortDescription: "Coach observations, squad reminders, and post-match capture space.",
          progressLabel: "NOTEBOOK",
          progressValue: "Ready",
          progressPercent: 42,
          status: "In Build",
          accent: "red",
          icon: "MN",
          points: ["Pre-match cues", "Bench notes", "Post-match review prompts"]
        }
      ],
      statusRows: [
        { title: "Campaign Window", meta: "Pre-Tournament", value: "Open" },
        { title: "Opponent File",   meta: "Next Review",    value: "48h" },
        { title: "Video Layer",     meta: "Current Batch",  value: "Updated" }
      ],
      pillars: [
        { title: "Preparation", text: "The squad arrives at meetings already understanding the main contest picture." },
        { title: "Evidence",    text: "Video, notes, and KPIs support decisions rather than decorate them." },
        { title: "Speed",       text: "Campaign layers must update fast without weakening clarity." }
      ]
    },

    // ── AI PLAYBOOK CONTEXT ──────────────────────────────────────────────
    playbookContext: "You are the Austria Youth Rugby playbook assistant. Use only the pathway context provided here. Keep answers concise, practical, and in plain text. Motto: Represent, Compete, Finish.\n\nAttack pitch principles: A = Clean exit (touch, minimal phases). B = Kick to contest if momentum allows. C = Starter plays, two avenues of attack, hold width. D = Vary forward attack, earn the right to go wide, play for points.\n\nDirection calls: BLACK = pass to forward off 9. RED = pass to forward off 10.\n\nPhase plays: Rhino = pick and go. Magic = forwards dummy-run, play released to backs. Boss = pull pass from forward to playmaker out the back. Tips = short pass close to contact. Fiji = change direction, snap back. England = 5-man lineout launch into Magic sequence. Wales = two forward pod carries then back inside. 2&2 = pods of 2 forwards, inside bind active, outside pre-binds on contact.\n\nKicking system: Tonic 1/2/3 = box kick system. Whiskey 1/2/3 = exit kick system. Vodka 1/2/3 = chip and regather system.\n\nLineout formations: 5 Man, 5+1, 6 Man, 6+1, Full. Throw codes: 4 = Forward, 3 = Back. TEMPO = quick throw before opposition sets. Lineout reads in order: Pre-set locations, Body shape, Are they switched on?, Can we tempo and get in and out?\n\nDefence pitch principles: A = Blitz (line speed, connected, no ruck over-commit). B = Organised line, connected, inside contest if possible. C = Guard B/C scanning, contest if possible, otherwise Back in game. D = Organised discipline, win collisions, apply kick pressure.\n\nDefensive roles: Inside CHOP = low dominant tackle inside. Outside TOP = high control tackle outside. Guard B = first defender next to ruck. Guard C = second defender next to ruck. Back in game = reload from breakdown into the defensive line.\n\nDefensive calls: Win The Race, Ready/Up, ICE, RED, Guard B, Guard C, Back in game.\n\nUnits: Back Three (15, 11, 14), Inside Backs (9, 10, 12, 13), Tight Five (1-5), Loose Forwards (6, 7, 8), Halfback Spine (9, 10, 15), Finishers (bench)."
  };
})();
