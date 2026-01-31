import 'dotenv/config';
import {google} from 'googleapis';
import {slice, sortBy, sum} from 'lodash-es';
import assert from 'node:assert';
import {WebClient} from '@slack/web-api';
import type {Block, KnownBlock, RichTextElement, RichTextSection} from '@slack/types';

interface Result {
  contest: number;
  rank: number;
  name: string;
  score: number;
  isNoContest: boolean;
}

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const sheetsData = await new Promise<string[][]>((resolve, reject) => {
  sheets.spreadsheets.values.get({
    spreadsheetId: process.env.IT_QUIZ_RESULTS_SHEET_ID,
    range: 'scores!A2:E',
  }, (error, response) => {
    if (error) {
      reject(error);
    } else if (response!.data.values) {
      resolve(response!.data.values as string[][]);
    } else {
      reject(new Error('values not found'));
    }
  });
});

const results: Result[] = sheetsData.flatMap(([contestStr, rankStr, name, scoreStr, isNoContestStr], lineNo) => {
  const contest = parseInt(contestStr);
  const rank = parseInt(rankStr);
  const score = parseInt(scoreStr);
  const isNoContest = isNoContestStr?.trim() === 'TRUE';

  for (const [key, value] of Object.entries({contest, rank, score})) {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      throw new Error(`[line ${lineNo}] Invalid number for ${key}: ${value}`);
    }
  }

  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`[line ${lineNo}] Invalid name: ${name}`);
  }

  if (contest <= 0) {
    throw new Error(`[line ${lineNo}] Contest must be positive: ${contest}`);
  }

  if (rank <= 0) {
    throw new Error(`[line ${lineNo}] Rank must be positive: ${rank}`);
  }

  if (score < 0) {
    throw new Error(`[line ${lineNo}] Score must be non-negative: ${score}`);
  }

  return [{contest, rank, name, score, isNoContest}];
});

console.log(`Fetched ${results.length} results`);

// Calculate ratings
const calculateRatings = (results: Result[]) => {
  const RATING_COUNT = 5;

  const ratedContests = Array.from(
    new Set(
      results.filter(({isNoContest}) => !isNoContest).map((r) => r.contest)
    )
  ).sort((a, b) => b - a);
  const users = Array.from(new Set(results.map((r) => r.name)));
  const userRatings = new Map(users.map((user) => [user, [] as {contest: number, rating: number}[]]));

  for (const result of results) {
    if (result.isNoContest) {
      continue;
    }

    if (result.rank > 10) {
      continue;
    }
    const ratings = userRatings.get(result.name)!;
    const contestIndex = ratedContests.indexOf(result.contest);
    assert(contestIndex >= 0);
    const contestFactor = 0.95 ** contestIndex;
    const rankFactor = 0.85 ** (result.rank - 1);
    const rating = 1000 * contestFactor * rankFactor;
    ratings.push({contest: result.contest, rating});
  }

  const finalRatings = Array.from(userRatings.entries()).map(([name, ratings]) => {
    const topRatings = slice(sortBy(ratings, (r) => -r.rating), 0, RATING_COUNT);
    topRatings.push(...Array(RATING_COUNT - topRatings.length).fill({contest: 0, rating: 0}));
    const averageRating = sum(topRatings.map((r) => r.rating)) / RATING_COUNT;
    return {name, rating: averageRating, topRatings};
  });

  finalRatings.sort((a, b) => b.rating - a.rating);

  console.log(`Calculated ratings (${finalRatings.length}):`);
  for (const {name, rating, topRatings} of finalRatings.slice(0, 20)) {
    // console.log(`${name}: ${rating.toFixed(2)} [${topRatings.map((r) => r.rating.toFixed(2) + ' (#' + r.contest + ')').join(', ')}]`);
    console.log(`${name}: ${rating.toFixed(2)}`);
  }

  return finalRatings;
};

const lastContest = Math.max(...results.map(({contest}) => contest));
const resultsWithoutLastContest = results.filter(({contest}) => contest < lastContest);

const oldRatings = calculateRatings(resultsWithoutLastContest);
const newRatings = calculateRatings(results);

// Post top 20 users to Slack
const slackClient = new WebClient(process.env.SLACK_TOKEN);

const top20 = newRatings.slice(0, 200);
const oldRatingsMap = new Map(oldRatings.map((r, index) => [r.name, {rating: r.rating, rank: index + 1}]));

const richTextListElements: RichTextSection[] = [];

for (let i = 0; i < top20.length; i++) {
  const user = top20[i];
  const currentRank = i + 1;
  const currentRating = user.rating;

  const oldData = oldRatingsMap.get(user.name);
  const oldRating = oldData?.rating ?? 0;
  const oldRank = oldData?.rank ?? 0;

  const ratingDiff = currentRating - oldRating;
  const rankChange = oldRank - currentRank;

  let rankChangeEmoji = '';
  let rankChangeText = '';
  if (oldRank === 0) {
    rankChangeEmoji = ':new:';
  } else if (rankChange > 0) {
    rankChangeEmoji = ':arrow_up_small:';
    rankChangeText = ` (+${rankChange})`;
  } else if (rankChange < 0) {
    rankChangeEmoji = ':arrow_down:';
    rankChangeText = ` (${rankChange})`;
  }

  const ratingDiffStr = ratingDiff >= 0 ? `+${ratingDiff.toFixed(2)}` : ratingDiff.toFixed(2);

  // Medal emoji for top 3
  let rankDisplay = '';
  if (currentRank === 1) {
    rankDisplay = ':first_place_medal:';
  } else if (currentRank === 2) {
    rankDisplay = ':second_place_medal:';
  } else if (currentRank === 3) {
    rankDisplay = ':third_place_medal:';
  }

  const elements: RichTextElement[] = [];

  // Rank
  if (rankDisplay !== '') {
    elements.push({
      type: 'emoji',
      name: rankDisplay.replace(/:/g, ''),
    });
    elements.push({
      type: 'text',
      text: ' ',
    });
  }

  // User name
  elements.push({
    type: 'text',
    text: user.name,
    style: {bold: true},
  });

  elements.push({
    type: 'text',
    text: ' ',
  });

  // Rating diff
  elements.push({
    type: 'text',
    text: `${currentRating.toFixed(2)} (${ratingDiffStr})`,
  });

  elements.push({
    type: 'text',
    text: ' ',
  });

  if (rankChangeEmoji !== '') {
    elements.push({
      type: 'emoji',
      name: rankChangeEmoji.replace(/:/g, ''),
    });
  }

  if (rankChangeText !== '') {
    elements.push({
      type: 'text',
      text: rankChangeText,
      style: {italic: true},
    });
  }

  richTextListElements.push({
    type: 'rich_text_section',
    elements,
  });
}

const blocks: (KnownBlock | Block)[] = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: `🏆 ITクイズ レーティング (#${lastContest})`,
      emoji: true,
    },
  },
  {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_list',
        style: 'ordered',
        elements: richTextListElements,
      },
    ],
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `最終更新: <!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>`,
      },
    ],
  },
];

/*
await slackClient.chat.postMessage({
  channel: process.env.SIG_QUIZ_CHANNEL_ID!,
  text: 'レーティング トップ20',
  blocks,
});
*/

console.log('Posted top 20 ratings to Slack');
