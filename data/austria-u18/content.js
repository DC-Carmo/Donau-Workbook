(function () {
  window.AUSTRIA_U18_DATA = {
    workspaceSections: [
      { slide: 1, group: "Program Core", shortLabel: "Cover", title: "National Cover" },
      { slide: 2, group: "Program Core", shortLabel: "Model", title: "Game Model" },
      { slide: 3, group: "Program Core", shortLabel: "Attack", title: "Attack System" },
      { slide: 4, group: "Program Core", shortLabel: "Defence", title: "Defensive System" },
      { slide: 5, group: "Program Core", shortLabel: "Set Piece", title: "Set Piece" },
      { slide: 6, group: "Campaign Layer", shortLabel: "Units", title: "Roles & Units" },
      { slide: 7, group: "Campaign Layer", shortLabel: "Analysis", title: "Analysis Hub" },
      { slide: 8, group: "Campaign Layer", shortLabel: "Assistant", title: "AI Playbook Assistant" }
    ],
    attackSidebar: {
      fieldAreas: [
        {
          name: "Core Lane",
          short: "Central launch picture",
          points: [
            "Primary tempo zone for launch, reload, and repeat pressure.",
            "Best area to straighten the line and fix the midfield.",
            "If tempo stalls here, reset the picture quickly and play again."
          ]
        },
        {
          name: "Pressure Lane",
          short: "Between middle and edge space",
          points: [
            "High-value decision zone for inside-out support and late release.",
            "Attack here to force hard choices on midfield defenders.",
            "Communication between 9, 10, and edge finishers must be early and specific."
          ]
        },
        {
          name: "Edge Lane",
          short: "15m to touchline",
          points: [
            "Finish space, not hopeful width.",
            "Back three must see kick, carry, and fold picture together.",
            "If the edge is closed, reload before forcing the finish."
          ]
        }
      ],
      directionCalls: [
        { key: "TOR", value: "Off 9 direct to the forward launch picture" },
        { key: "RING", value: "Off 9 to the midfield decision-maker" },
        { key: "SHIFT", value: "Change the point of attack off 9" },
        { key: "SPINE", value: "Out the back to the second-layer playmaker" }
      ],
      pods: [
        { key: "ALPS", value: "1, 2, 3 · front-five collision and cleanout unit" },
        { key: "DANUBE", value: "4, 5, 8 · launch, carry, and lineout spine" },
        { key: "FALCON", value: "6, 7 · mobility, pressure, and edge support" }
      ]
    },
    attackData: {
      setpiece: [
        {
          name: "Crest 12",
          type: "Scrum Starter",
          detail: [
            "8 to 9, 12 fixes inside shoulder of opposition 10.",
            "10 out the back and straightens to hold 12.",
            "13 keeps the edge honest, back three hold depth."
          ]
        },
        {
          name: "Summit",
          type: "Midfield Scrum",
          detail: [
            "Front picture shows pod carry, second layer plays behind.",
            "Best used when defence is tight around source.",
            "Outside support must be alive for late transfer."
          ]
        },
        {
          name: "Crosswind",
          type: "Lineout Launch",
          detail: [
            "Short transfer off the lineout to move pressure away from touch.",
            "Back-field connection creates the second play immediately.",
            "Use when maul threat has already fixed defenders."
          ]
        }
      ],
      phase: [
        {
          name: "Pulse",
          type: "Phase Direction",
          detail: [
            "Fast-ball picture to attack before fold is live.",
            "First receiver stays flat enough to challenge line speed.",
            "Outside support runs for connection, not drift."
          ]
        },
        {
          name: "Glide",
          type: "Phase Direction",
          detail: [
            "Ball moves behind live runners without losing inside threat.",
            "Used when defence is overfolding early.",
            "Pod must stay a real option."
          ]
        },
        {
          name: "Clamp",
          type: "Slow Ball Reset",
          detail: [
            "Tight, efficient carry to rebuild shape after slow ball.",
            "Keep support square and arrive early on latch."
          ]
        },
        { name: "Snap", type: "Call", detail: ["Short switch to attack inside shoulder."] },
        { name: "Echo", type: "Call", detail: ["Dummy switch into second-layer release."] },
        { name: "Blade", type: "Call", detail: ["Hard unders line to split folding defenders."] },
        { name: "Mirror", type: "Call", detail: ["Same picture shown both sides before late decision."] }
      ],
      exits: [
        {
          name: "Hammer",
          type: "Exit Kick Type",
          detail: ["Long clearance to win distance and reset the field."]
        },
        {
          name: "Steel",
          type: "Exit Kick Type",
          detail: ["Contestable kick with connected chase and pressure line."]
        },
        {
          name: "Latch",
          type: "Exit Option",
          detail: ["Carry-first option when kick picture is not clean enough."]
        },
        {
          name: "Rail Left",
          type: "Sequenced Exit",
          detail: [
            "Lineout feed into two clean phases before left-foot clearance.",
            "Back-field and edge chasers align before phase three."
          ]
        },
        {
          name: "Rail Right",
          type: "Sequenced Exit",
          detail: [
            "Mirrored right-side build with same phase-three discipline.",
            "Use when field picture opens to the 10-channel."
          ]
        }
      ],
      calls: [
        { name: "Core Lane", type: "Field Landmark", detail: ["Central field zone for launch and tempo."] },
        { name: "Pressure Lane", type: "Field Landmark", detail: ["Between middle and edge — decision-rich channel."] },
        { name: "Edge Lane", type: "Field Landmark", detail: ["15m to touchline finish zone."] },
        { name: "TOR", type: "Direction", detail: ["Off 9 to forward launch picture."] },
        { name: "RING", type: "Direction", detail: ["Off 9 to midfield decision-maker."] },
        { name: "SHIFT", type: "Direction", detail: ["Change point of attack off 9."] },
        { name: "SPINE", type: "Direction", detail: ["Out the back to second-layer playmaker."] },
        { name: "LOCK", type: "Override", detail: ["Must keep ball in front-five picture."] }
      ]
    },
    defenceRoles: [
      { name: "AXE", desc: "First tackler. Wins shoulder, cuts space, and finishes the picture low and hard." },
      { name: "HUNT", desc: "Inside pressure defender. Closes space early and attacks the next action." },
      { name: "DOUBLE HUNT", desc: "Second inside defender. Reads breakdown picture and fold urgency." },
      { name: "COP", desc: "Outside organiser. Protects width, fixes spacing, and keeps the edge honest." }
    ],
    defenceCalls: [
      { name: "READY / UP", action: "Primary line call when the edge is set and connected." },
      { name: "HAMMER", action: "Full line-speed picture when numbers and spacing are live." },
      { name: "HOVER", action: "Controlled drift when shape is incomplete or late." },
      { name: "STORM", action: "Red-zone change-up with hard up-and-in commitment." },
      { name: "RED", action: "Tap, linebreak, or emergency scramble call." },
      { name: "ICE", action: "Counter-ruck trigger." },
      { name: "SPACE", action: "Get past the ball and rebuild the line." },
      { name: "STEAL", action: "Pilfer chance is live." }
    ],
    defData: {
      rhs: {
        green: {
          title: "Green Zone · Low Risk",
          color: "g",
          points: [
            "9 can close short side or sit neutral based on scrum angle and edge threat.",
            "Back three keep a connected pendulum and solve kick-return early.",
            "7 covers inside pressure while 8 protects pocket access."
          ]
        },
        orange: {
          title: "Orange Zone · Mid Field",
          color: "o",
          points: [
            "Blind alignment changes the 9 picture; match it early and communicate it loudly.",
            "15 must move before the pass if the edge picture is changing.",
            "Do not lose inside connection while solving the edge."
          ]
        },
        red: {
          title: "Red Zone · Danger",
          color: "r",
          points: [
            "Blind winger holds short side longer and moves fast on release.",
            "15 protects kick space first, then works to edge support.",
            "STORM is available when the attack is sitting too comfortably."
          ]
        }
      },
      lhs: {
        green: {
          title: "Green Zone · Low Risk",
          color: "g",
          points: [
            "9 stays on feed side or neutral depending on width and pressure picture.",
            "Midfield aligns outside shoulder and pushes into next channel together.",
            "6 and 7 must protect short-side detail before overchasing width."
          ]
        },
        orange: {
          title: "Orange Zone · Mid Field",
          color: "o",
          points: [
            "Blind wing holds until ball is released open.",
            "Midfield must stay square enough to close the gate on inside balls.",
            "Short-side awareness matters before the feed, not after."
          ]
        },
        red: {
          title: "Red Zone · Danger",
          color: "r",
          points: [
            "15 starts deeper in support pocket of the midfield.",
            "Blind wing protects width on the short side until release.",
            "The line cannot overrun the kick picture."
          ]
        }
      },
      cfs: {
        green: {
          title: "Centre Field Scrum · Green",
          color: "g",
          points: [
            "10 and 12 defend together on the side with greatest attacking numbers.",
            "9 pressures scrum angle while 13 and 7 own inside-out connection.",
            "Back three keep the pendulum live behind the line."
          ]
        },
        orange: {
          title: "Centre Field Scrum · Orange",
          color: "o",
          points: [
            "Same shape with greater urgency on midfield spacing.",
            "10 and 12 cannot leave a soft seam between them.",
            "9 decisions become more influential as space tightens."
          ]
        },
        red: {
          title: "Centre Field Scrum · Red",
          color: "r",
          points: [
            "Prepare for kick and linebreak threat at the same time.",
            "Back-field must move with the defensive line, not behind it.",
            "STORM remains available as a pressure change-up."
          ]
        }
      }
    },
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
    units: [
      {
        title: "Back Three",
        subtitle: "15 · 11 · 14",
        attack: ["Own edge-lane finish decisions.", "Stay alive for kick-return and second-play pictures."],
        defence: ["Solve pendulum early.", "Protect kick space before chase space."],
        setPiece: ["Connect to exit plan immediately.", "Hold width without disconnecting from chase picture."]
      },
      {
        title: "Inside Backs",
        subtitle: "9 · 10 · 12 · 13",
        attack: ["Share one field picture before ball leaves source.", "Straighten play and decide early."],
        defence: ["Keep the gate closed inside-out.", "Drive line-speed language for the rest of the line."],
        setPiece: ["Own launch clarity from scrum and lineout.", "Call the next play before contact."]
      },
      {
        title: "Tight Five",
        subtitle: "1 · 2 · 3 · 4 · 5",
        attack: ["Create clean collision pictures.", "Reload into launch support fast."],
        defence: ["Win first contact near source.", "Protect fold integrity under fatigue."],
        setPiece: ["Set the national standard at scrum and lineout.", "Create usable ball, not just retained ball."]
      },
      {
        title: "Loose Forwards",
        subtitle: "6 · 7 · 8",
        attack: ["Link inside pressure to outside speed.", "Be first into reload windows."],
        defence: ["Solve short-side detail and breakdown pressure.", "Hunt past the ball without losing shape."],
        setPiece: ["Support lineout movement and back-field connection.", "Keep launch alive after first action."]
      },
      {
        title: "Halfback Spine",
        subtitle: "9 · 10 · 15",
        attack: ["Manage tempo and territorial decisions.", "Keep second-layer picture calm under pressure."],
        defence: ["Align line, back-field, and kick response quickly.", "Own emergency decisions when shape breaks."],
        setPiece: ["Translate the platform into the correct contest picture.", "Protect exit discipline."]
      },
      {
        title: "Finishers",
        subtitle: "Bench Impact",
        attack: ["Lift tempo without losing clarity.", "Add accuracy, not chaos, to the final quarter."],
        defence: ["Bring fresh line speed and fold urgency.", "Close the game with discipline."],
        setPiece: ["Hold standards when fatigue rises.", "Protect the final launch pictures."]
      }
    ],
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
        { title: "Opponent File", meta: "Next Review", value: "48h" },
        { title: "Video Layer", meta: "Current Batch", value: "Updated" }
      ],
      pillars: [
        { title: "Preparation", text: "The squad should arrive at meetings already understanding the main contest picture." },
        { title: "Evidence", text: "Video, notes, and KPIs should support decisions rather than decorate them." },
        { title: "Speed", text: "Campaign layers must update fast without weakening clarity." }
      ]
    },
    playbookContext: "You are the Austria U18 National Team playbook assistant. Use only the environment context provided here. Keep answers concise, practical, and written in plain text. Motto: Represent, Compete, Finish. Field landmarks: Core Lane, Pressure Lane, Edge Lane. Forward units: ALPS = 1,2,3; DANUBE = 4,5,8; FALCON = 6,7. Direction calls: TOR = off 9 to forward launch picture. RING = off 9 to midfield decision-maker. SHIFT = change point of attack off 9. SPINE = out the back to second-layer playmaker. Attack calls: Pulse, Glide, Clamp, Snap, Echo, Blade, Mirror. Exit calls: Hammer, Steel, Latch, Rail Left, Rail Right. Defensive roles: Axe, Hunt, Double Hunt, Cop. Defensive calls: Ready/Up, Hammer, Hover, Storm, Red, Ice, Space, Steal. Game model: selection standard, national identity, dominant line speed, set piece clarity, unit connection, disciplined finish. Set piece: 40, 50, 70, 80 formation language; Alpha and Zulu trigger layer; lineout, scrum, and maul treated as one contest area. Unit cards: Back Three, Inside Backs, Tight Five, Loose Forwards, Halfback Spine, Finishers. Analysis hub themes: Opponent Prep, Film Review, Stats & KPIs, Match Notes."
  };
})();
