// Short, practical tips in plain words. One shows on Today each day; all of them live on the Tips page.

export const TIP_GROUPS: { title: string; icon: string; tips: string[] }[] = [
  {
    title: 'Getting started',
    icon: '🌱',
    tips: [
      'Start smaller than you think. "Read one page" beats "read a chapter" you never start.',
      'Pick one habit at a time. Add the next one once the first feels easy.',
      'Decide exactly when and where: "At 7:00, in the kitchen, I will…". Vague plans rarely happen.',
      'Stack it on something you already do: "After I brush my teeth, I will floss one tooth."',
      'Focus on showing up, not on results. The first goal is to become someone who does it at all.',
      'Write your "why" down. On hard days, it reminds you what this is for.',
    ],
  },
  {
    title: 'Staying consistent',
    icon: '🔥',
    tips: [
      'Never miss twice. One missed day is an accident; two is the start of a new habit.',
      'On tough days, do the 2-minute version. It keeps the streak and the identity alive.',
      'Lay things out the night before: shoes by the door, book on the pillow.',
      'Make it visible. Put the guitar in the middle of the room, not in the closet.',
      'Check off right after you finish. The little reward helps your brain remember.',
      'Your best days on the Progress page show when you are strongest. Plan harder habits for those days.',
      "If a habit keeps failing, make it easier, don't just try harder.",
    ],
  },
  {
    title: 'Breaking bad habits',
    icon: '✂️',
    tips: [
      'Find the trigger. Most bad habits start with a cue: boredom, a place, a time, a feeling.',
      'Hide the cue. Out of sight really is out of mind: phone in another room, snacks off the counter.',
      'Add friction. Every extra step (logging out, unplugging, putting it on a high shelf) helps.',
      'Replace, don\'t just remove. Decide what you will do instead when the urge shows up.',
      'Notice what it costs you. Say it out loud: "This makes me tired tomorrow."',
      'A slip is information, not failure. Write down what triggered it and plan for next time.',
    ],
  },
  {
    title: 'Motivation & identity',
    icon: '🪞',
    tips: [
      'Every check-off is a vote for who you want to become. You don\'t need every vote, just most.',
      'Say "I am a reader", not "I\'m trying to read more". Identity drives behavior.',
      'Pair it with something you love: a podcast only while walking, a favorite tea only while reading.',
      'Tell someone your plan, or make a habit contract. Being watched helps.',
      'Look at your Progress chart on a bad day. Small wins really are adding up.',
      'Spend time with people who already have the habit you want. Their normal becomes yours.',
    ],
  },
  {
    title: 'Leveling up',
    icon: '📈',
    tips: [
      'When a habit feels easy, make it a little harder, about 10–20% more. Not too easy, not too hard.',
      "Boredom is the real enemy of long habits. Small changes and level-ups keep it interesting.",
      'After 66 days a habit often feels automatic. That is the time to level it up or add a new one.',
      'Review once a week: what worked, what didn\'t, what to make easier.',
    ],
  },
]

export const ALL_TIPS = TIP_GROUPS.flatMap((g) => g.tips.map((tip) => ({ tip, icon: g.icon, group: g.title })))

/** The same tip all day, a new one tomorrow. */
export function tipOfTheDay(dayNumber: number) {
  return ALL_TIPS[((dayNumber % ALL_TIPS.length) + ALL_TIPS.length) % ALL_TIPS.length]
}
