import { collectOfficialFeedDataset } from "../src/collector.js";

const generatedAt = "2026-05-23T02:00:00Z";
const feedXml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Mock AI Feed</title>
    <item>
      <title>OpenAI launches agent workflow runtime</title>
      <link>https://example.com/openai-agent-runtime</link>
      <description>Official release notes describe a new agent runtime for developers.</description>
      <pubDate>Fri, 23 May 2026 00:00:00 GMT</pubDate>
      <category>agents</category>
      <category>developers</category>
    </item>
    <item>
      <title>Hugging Face releases evaluation recipe</title>
      <link>https://example.com/hf-eval-recipe</link>
      <description>Official guidance explains an evaluation workflow and deployment checklist.</description>
      <pubDate>Thu, 22 May 2026 23:00:00 GMT</pubDate>
      <category>models</category>
      <category>research</category>
    </item>
  </channel>
</rss>`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function mockFetch(url) {
  if (String(url).includes("api.xiaomimimo.com")) {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [
                  {
                    issueId: "issue-fallback",
                    conclusion: "invalid"
                  }
                ]
              })
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }

  return new Response(feedXml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml"
    }
  });
}

async function mockFetchWithValidMimo(url) {
  if (String(url).includes("api.xiaomimimo.com")) {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [
                  {
                    issueId: validIssueId,
                    conclusion: "공식 채널에서 에이전트 운영 계층 강화 흐름이 확인됐다.",
                    summary: {
                      whatHappened: "OpenAI와 Hugging Face 공식 업데이트가 에이전트 운영과 평가 흐름으로 묶였다.",
                      whyMatters: "도입 판단이 모델 단품보다 운영 구조와 평가 체계로 이동하고 있음을 보여준다.",
                      whoAffected: "개발자, PM, 리더",
                      nextAction: "원문 기준으로 운영 자동화와 평가 체크리스트를 분리해 검토한다."
                    }
                  }
                ]
              })
            }
          }
        ]
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }

  return mockFetch(url);
}

const baselineCollection = await collectOfficialFeedDataset({
  generatedAt,
  fetchFn: mockFetch,
  env: {},
  feeds: [
    {
      id: "openai-news",
      publisher: "OpenAI",
      homeUrl: "https://openai.com/blog",
      feedUrl: "https://openai.com/news/rss.xml",
      sourceType: "official",
      reliability: 5,
      categories: ["models", "agents", "business"],
      audiences: ["developer", "pm", "leader"],
      practicalValue: 86,
      koreaRelevance: 62,
      risk: 42,
      importance: 82,
      velocity: 76
    }
  ]
});

const validIssueId = baselineCollection.payload.issues[0].id;

const fallbackCollection = await collectOfficialFeedDataset({
  generatedAt,
  fetchFn: mockFetch,
  env: {
    MIMO_API_KEY: "test-key",
    MIMO_MODEL: "mimo-v2.5"
  },
  feeds: [
    {
      id: "openai-news",
      publisher: "OpenAI",
      homeUrl: "https://openai.com/blog",
      feedUrl: "https://openai.com/news/rss.xml",
      sourceType: "official",
      reliability: 5,
      categories: ["models", "agents", "business"],
      audiences: ["developer", "pm", "leader"],
      practicalValue: 86,
      koreaRelevance: 62,
      risk: 42,
      importance: 82,
      velocity: 76
    },
    {
      id: "huggingface-blog",
      publisher: "Hugging Face",
      homeUrl: "https://huggingface.co/blog",
      feedUrl: "https://huggingface.co/blog/feed.xml",
      sourceType: "official",
      reliability: 4,
      categories: ["models", "open_source", "research"],
      audiences: ["developer", "researcher", "learner"],
      practicalValue: 83,
      koreaRelevance: 67,
      risk: 36,
      importance: 78,
      velocity: 72
    }
  ]
});

assert(fallbackCollection.details.summarizer.status === "partial", "invalid MiMo payload should downgrade to partial");

const collection = await collectOfficialFeedDataset({
  generatedAt,
  fetchFn: mockFetchWithValidMimo,
  env: {
    MIMO_API_KEY: "test-key",
    MIMO_MODEL: "mimo-v2.5"
  },
  feeds: [
    {
      id: "openai-news",
      publisher: "OpenAI",
      homeUrl: "https://openai.com/blog",
      feedUrl: "https://openai.com/news/rss.xml",
      sourceType: "official",
      reliability: 5,
      categories: ["models", "agents", "business"],
      audiences: ["developer", "pm", "leader"],
      practicalValue: 86,
      koreaRelevance: 62,
      risk: 42,
      importance: 82,
      velocity: 76
    }
  ]
});

assert(collection.details.summarizer.status === "completed", "MiMo summary should complete with valid payload");
assert(collection.details.summarizer.model === "mimo-v2.5", "MiMo model should be recorded");
assert(collection.payload.issues[0].summary.whyMatters.includes("운영 구조"), "MiMo summary should replace heuristic fields");

console.log("Lokana Worker MiMo smoke passed.");
