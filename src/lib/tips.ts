// Plain-language explanations behind the little "?" buttons, for people who haven't read the book.

export const TIPS = {
  streak: {
    title: '🔥 Streak',
    body: 'How many times in a row you did this habit. Every time you keep it going, the number grows. You also earn points and badges for long streaks.',
  },
  freeze: {
    title: '🧊 Streak freeze',
    body: 'Every 7 days in a row you earn a freeze (you can save up to 2). If you miss a day, a freeze is used automatically and your streak survives. But a freeze can never be used two days in a row. Miss twice in a row and the streak resets. So if a freeze saved you yesterday, do the habit today!',
  },
  never_miss_twice: {
    title: 'Never miss twice',
    body: "Everyone misses a day sometimes, and one miss doesn't matter. What matters is not missing two days in a row, because that's how a new bad habit starts. If you missed yesterday, today is the most important day.",
  },
  two_min: {
    title: '⏱️ The 2-minute version',
    body: 'A tiny version of your habit that takes 2 minutes or less, like "read one page" instead of "read a chapter". On busy or tired days, do the tiny version. It still counts and keeps your streak. Showing up is what builds the habit.',
  },
  stacking: {
    title: '🔗 Habit stacking',
    body: 'Attach your new habit to something you already do every day: "After I pour my coffee, I will meditate for one minute." The old habit becomes a reminder for the new one.',
  },
  identity: {
    title: '🪞 Identity',
    body: 'Instead of "I want to read more", think "I am a reader". Every time you do the habit, you cast a vote for being that person. The more votes, the more it becomes who you are.',
  },
  points: {
    title: '⭐ Points & levels',
    body: 'Every check-off earns points: 10 for the full habit, 5 for the 2-minute version, 5 for each clean day of a habit you are breaking, and 25 bonus points for each badge. Points raise your level. Each level needs a bit more than the last.',
  },
  badges: {
    title: '🏅 Badges',
    body: 'Reach a streak of 3, 7, 14, 21, 30, 66, 100, 200 or 365 to earn a badge. Badges stay yours forever, even if the streak breaks later. 66 days is about how long it takes for a habit to start feeling automatic.',
  },
  level_up: {
    title: '📈 Leveling up a habit',
    body: 'When a habit starts to feel easy, make it a little harder (about 10–20% more), like going from 5 pages to 6. Too easy is boring and too hard makes you quit. Aim for "just right". The app suggests this after about two steady weeks.',
  },
  bundle: {
    title: '🎁 Pair it with a treat',
    body: 'Link the habit to something you enjoy and only allow the treat during the habit, like your favorite podcast only while walking. Then you start looking forward to the habit.',
  },
  contract: {
    title: '🤝 Habit contract',
    body: 'A promise to someone else, with a small cost if you break it. Knowing someone is watching makes it much easier to stick with it.',
  },
  scorecard: {
    title: '📋 Habits Scorecard',
    body: 'Most habits happen on autopilot. Write down your normal day and mark each thing as good (+), neutral (=) or bad (−). Then you can track any of them as a habit, including how long you have already been doing it.',
  },
} as const

export type TipKey = keyof typeof TIPS
