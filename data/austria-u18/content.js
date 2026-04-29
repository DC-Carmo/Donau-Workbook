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
        { key: "RED",   value: "Pass to forward off 10" },
        { key: "FIJI",  value: "Snapback" }
      ],
      pods: []
    },

    // ── ATTACK TABS ─────────────────────────────────────────────────────
    attackData: {
      setpiece: [
        {
          name: "Charlie's",
          type: "LINEOUT / SCRUM STARTER",
          detail: [
            "Starter used from lineout or scrum platform.",
            "Shape and timing must be clear before launch.",
            "Run with connected support and decisive first action."
          ]
        },
        {
          name: "M.L",
          type: "LINEOUT STARTER",
          detail: [
            "Lineout starter used to launch with clarity.",
            "First movement must hold the defence and create the picture.",
            "Support lines stay early and connected through the launch."
          ]
        },
        {
          name: "L.A",
          type: "LINEOUT STARTER",
          detail: [
            "Lineout starter built to launch into the next phase cleanly.",
            "Timing off the throw must be accurate and connected.",
            "Attack the space created by the initial movement."
          ]
        },
        {
          name: "Special",
          type: "LINEOUT / SCRUM STARTER",
          detail: [
            "Starter available from lineout or scrum platform.",
            "Requires clear communication before the launch trigger.",
            "Support must be in position to carry the next action."
          ]
        },
        {
          name: "O³",
          type: "SCRUM STARTER",
          detail: [
            "9 + 12 fix opposition 10 inside.",
            "10 out the back, straightens to fix opposition 12.",
            "11 hits seam at pace.",
            "13 fixes opposition 13, back three hold width."
          ]
        },
        {
          name: "Launch 41",
          type: "SCRUM STARTER",
          detail: [
            "9 to 14.",
            "12 short, attacking opposition 10.",
            "10 out back.",
            "Option of playing slider between 13 and 15."
          ]
        }
      ],
      phase: [
        {
          name: "Rhino",
          type: "PHASE PLAY",
          detail: [
            "Pick and go.",
            "Forward takes the ball from the base and drives hard into contact.",
            "Best used when the defence is still folding or numbers are short."
          ]
        },
        {
          name: "Magic",
          type: "PHASE PLAY",
          detail: [
            "Forwards act as dummy runners. Play released to backs.",
            "Forwards show carry intent to fix defensive attention.",
            "Ball moves through or behind them to the backs line."
          ]
        },
        {
          name: "Boss",
          type: "PHASE PLAY",
          detail: [
            "Pull pass from a forward to the playmaker ??? out the back.",
            "Forward fixes the inside defenders. Playmaker arrives late with space.",
            "Effective when defence over-commits to the carry picture."
          ]
        },
        {
          name: "Tips",
          type: "PHASE PLAY",
          detail: [
            "Short pass close to contact.",
            "Attack the shoulder of the defender just before or after contact.",
            "Requires tight timing and early connection from support."
          ]
        },
        {
          name: "Fiji",
          type: "PHASE PLAY",
          detail: [
            "Change direction ??? snap the ball back against the grain.",
            "Attack the blind side of the defence before they can reset.",
            "Requires clear communication and a sharp support runner arriving from depth."
          ]
        },
        {
          name: "England",
          type: "PHASE PLAY",
          detail: [
            "5-man lineout launch. Forwards carry same direction to fix the defence.",
            "Then Magic: forwards become dummy runners, ball releases to backs.",
            "Sets up the backs line late after a forward-heavy picture has been shown."
          ]
        },
        {
          name: "Wales",
          type: "PHASE PLAY",
          detail: [
            "Two forward carries in the middle in the same pod picture.",
            "Then play back inside off the second carry.",
            "Forces the defence to commit before the ball reverses."
          ]
        },
        {
          name: "Full",
          type: "PHASE PLAY",
          detail: [
            "Phase play used to keep the attack connected across the line.",
            "Support must reload early and stay square through the action.",
            "Play with tempo and accuracy after the initial picture is shown."
          ]
        }
      ],
      exits: [
        {
          name: "Tonic",
          type: "Kicking Series · Box Kick",
          detail: [
            "9 controls the kick from the base of the ruck or scrum.",
            "Kick to a contestable area (\"box\") for the wings to compete.",
            "Chase must be early, connected, and aggressive.",
            "1 → High + short (maximum hang time to compete)",
            "2 → Medium depth (space between winger and fullback)",
            "3 → Long/deep (push back three and win territory)"
          ]
        },
        {
          name: "Whiskey",
          type: "Kicking Series · Exit Kick",
          detail: [
            "Used to exit our half and relieve pressure.",
            "Priority is distance and territory, not contest.",
            "Backfield must be organised before the kick.",
            "1 → Find touch (stop play and reset)",
            "2 → Long downfield (find space, force return)",
            "3 → Maximum distance (spiral/torpedo)"
          ]
        },
        {
          name: "Vodka",
          type: "Kicking Series · Chip & Regather",
          detail: [
            "Used to beat fast line speed.",
            "Attack space behind or through the line.",
            "Support must react early to regather.",
            "1 → Grubber (through the line)",
            "2 → Chip (over first defender)",
            "3 → Cross-field (to weak side winger)"
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
              title: "Primary Calls",
              items: [
                { name: "L · Front", sub: "80 / 70 formation", detail: "Front lift with fast transfer option back into launch picture." },
                { name: "O · Back", sub: "80 / 70 formation", detail: "Tail option when opposition chases the front trigger." },
                { name: "U · Counter", sub: "80 / 70 formation", detail: "Counter move to punish overcommitment to the standard picture." }
              ]
            },
            {
              title: "Trigger Layer",
              items: [
                { name: "Alpha", sub: "Front pressure", detail: "Late acceleration into the front lift." },
                { name: "Zulu", sub: "Back pressure", detail: "Late acceleration into the tail lift." },
                { name: "Cat", sub: "Immediate release", detail: "Direct front delivery when the picture is clean." }
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
              title: "Core Roles",
              items: [
                { name: "Wedge", sub: "Entry role", detail: "Arrive square, same time, and drive under the picture." },
                { name: "Transfer", sub: "Ball movement", detail: "Move the ball only when momentum is controlled." },
                { name: "Spare", sub: "Picture reader", detail: "Find the next winning job, not the nearest body." }
              ]
            },
            {
              title: "Maul Non-Negotiables",
              items: [
                { name: "Height", sub: "Body shape", detail: "Win the race under the chest line and stay connected." },
                { name: "Patience", sub: "Decision-making", detail: "Do not rush the transfer before the picture is earned." },
                { name: "Exit", sub: "Next action", detail: "Know whether the maul is for score, pressure, or launch." }
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
    playbookContext: "You are the Austria Youth Rugby playbook assistant. Use only the pathway context provided here. Keep answers concise, practical, and in plain text. Motto: Represent, Compete, Finish.\n\nAttack pitch principles: A = Clean exit (touch, minimal phases). B = Kick to contest if momentum allows. C = Starter plays, two avenues of attack, hold width. D = Vary forward attack, earn the right to go wide, play for points.\n\nDirection calls: BLACK = pass to forward off 9. RED = pass to forward off 10.\n\nPhase plays: Rhino = pick and go. Magic = forwards dummy-run, play released to backs. Boss = pull pass from forward to playmaker out the back. Tips = short pass close to contact. Fiji = change direction, snap back. 2&2 = pods of 2 forwards, inside bind active, outside pre-binds on contact.\n\nSet piece starters: England = 5-man lineout launch into Magic sequence. Wales = two forward pod carries then back inside. O? = structured starter used to launch with clarity from the set piece platform. Launch 41 = set piece starter built to create an immediate launch picture.\n\nKicking system: Tonic 1/2/3 = box kick system. Whiskey 1/2/3 = exit kick system. Vodka 1/2/3 = chip and regather system.\n\nLineout formations: 5 Man, 5+1, 6 Man, 6+1, Full. Throw codes: 4 = Forward, 3 = Back. TEMPO = quick throw before opposition sets. Lineout reads in order: Pre-set locations, Body shape, Are they switched on?, Can we tempo and get in and out?\n\nDefence pitch principles: A = Blitz (line speed, connected, no ruck over-commit). B = Organised line, connected, inside contest if possible. C = Guard B/C scanning, contest if possible, otherwise Back in game. D = Organised discipline, win collisions, apply kick pressure.\n\nDefensive roles: Inside CHOP = low dominant tackle inside. Outside TOP = high control tackle outside. Guard B = first defender next to ruck. Guard C = second defender next to ruck. Back in game = reload from breakdown into the defensive line.\n\nDefensive calls: Win The Race, Ready/Up, ICE, RED, Guard B, Guard C, Back in game.\n\nUnits: Back Three (15, 11, 14), Inside Backs (9, 10, 12, 13), Tight Five (1-5), Loose Forwards (6, 7, 8), Halfback Spine (9, 10, 15), Finishers (bench)."
  };
})();
