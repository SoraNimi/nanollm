import assert from "node:assert/strict";

import {
  anthropicMessageRequestToChatParams,
  anthropicMessageRequestToResponsesRequest,
  anthropicMessageToChatCompletion,
  anthropicMessageToResponsesResponse,
  chatCompletionToAnthropicMessage,
  chatParamsToAnthropicMessageRequest,
  chatParamsToResponsesRequest,
  responsesRequestToAnthropicMessageRequest,
  responsesRequestToChatParams,
  responsesResponseToChatCompletion,
} from "../src/converters/index.js";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function runThrows(name: string, fn: () => void, expectedMessage: string) {
  run(name, () => {
    assert.throws(fn, new RegExp(expectedMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

run("chat tool result becomes anthropic tool_result block", () => {
  const result = chatParamsToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    messages: [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_weather", arguments: "{\"city\":\"Shanghai\"}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "Sunny" },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
        },
      },
    ],
  });

  assert.equal(result.messages[1].role, "assistant");
  assert.equal(result.messages[2].role, "user");
  assert.equal((result.messages[2].content as Array<{ type: string }>)[0].type, "tool_result");
});

run("anthropic tool_result becomes chat tool message", () => {
  const result = anthropicMessageRequestToChatParams({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "call_1", caller: { type: "direct" }, name: "get_weather", input: { city: "Shanghai" } }],
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "Sunny" }] },
    ],
  });

  assert.equal(result.messages[2].role, "tool");
  assert.equal((result.messages[2] as { tool_call_id: string }).tool_call_id, "call_1");
});

run("responses tool output becomes anthropic tool_result block", () => {
  const result = responsesRequestToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    input: [{ type: "function_call_output", call_id: "call_1", output: "Sunny" }],
  });

  assert.equal(result.messages[0].role, "user");
  assert.equal((result.messages[0].content as Array<{ type: string }>)[0].type, "tool_result");
});

run("string content survives chat to responses to chat", () => {
  const responses = chatParamsToResponsesRequest({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hello" }],
  });

  const chat = responsesRequestToChatParams(responses);
  assert.equal(chat.messages[0].role, "user");
  assert.equal(chat.messages[0].content, "hello");
});

run("unsupported request fields are ignored instead of failing", () => {
  const chatToResponses = chatParamsToResponsesRequest({
    model: "gpt-4o-mini",
    frequency_penalty: 0.5,
    messages: [{ role: "user", content: "hello" }],
  } as any);
  assert.equal(chatToResponses.model, "gpt-4o-mini");

  const responsesToChat = responsesRequestToChatParams({
    model: "gpt-5",
    background: true,
    input: "hello",
  } as any);
  assert.equal(responsesToChat.model, "gpt-5");

  const anthropicToChat = anthropicMessageRequestToChatParams({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    top_k: 5,
    messages: [{ role: "user", content: "hello" }],
  } as any);
  assert.equal(anthropicToChat.model, "claude-sonnet-4-5");
});

run("built-in tools are ignored instead of failing", () => {
  const chatToResponses = chatParamsToResponsesRequest({
    model: "gpt-5",
    messages: [{ role: "user", content: "hello" }],
    tools: [{ type: "web_search_preview" }],
    tool_choice: "auto",
  } as any);
  assert.equal(chatToResponses.tools?.length ?? 0, 0);

  const responsesToChat = responsesRequestToChatParams({
    model: "gpt-5",
    input: "hello",
    tools: [{ type: "web_search" }],
    tool_choice: { type: "web_search" },
  } as any);
  assert.equal(responsesToChat.tools?.length ?? 0, 0);
  assert.equal((responsesToChat as any).tool_choice, undefined);
});

run("chat verbosity survives chat to responses to chat", () => {
  const responses = chatParamsToResponsesRequest({
    model: "gpt-5",
    verbosity: "low",
    messages: [{ role: "user", content: "hello" }],
  } as any);

  assert.equal((responses.text as any).verbosity, "low");

  const chat = responsesRequestToChatParams(responses);
  assert.equal((chat as any).verbosity, "low");
});

run("object content survives anthropic to responses conversion for images", () => {
  const responses = anthropicMessageRequestToResponsesRequest({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [{ type: "image", source: { type: "url", url: "https://example.com/a.png" } }],
      },
    ],
  });

  const first = (responses.input as Array<{ content: Array<{ type: string; image_url?: string }> }>)[0];
  assert.equal(first.content[0].type, "input_image");
  assert.equal(first.content[0].image_url, "https://example.com/a.png");
});

run("chat completion response with tool_calls becomes anthropic tool_use response", () => {
  const result = chatCompletionToAnthropicMessage({
    id: "chat_1",
    object: "chat.completion",
    created: 1,
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls",
        logprobs: null,
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: "{\"city\":\"Shanghai\"}" } }],
        },
      },
    ],
  } as any);

  assert.equal(result.content[0].type, "tool_use");
});

run("responses response with tool call becomes chat completion tool_calls", () => {
  const result = responsesResponseToChatCompletion({
    id: "resp_1",
    object: "response",
    created_at: 1,
    model: "gpt-4o-mini",
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    output: [{ id: "call_1", type: "function_call", call_id: "call_1", name: "get_weather", arguments: "{\"city\":\"Shanghai\"}", status: "completed" }],
    parallel_tool_calls: false,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    status: "completed",
    text: { format: { type: "text" } },
  } as any);

  assert.equal(result.choices[0].message.tool_calls?.[0].type, "function");
});

run("anthropic response with tool_use becomes chat completion tool_calls", () => {
  const result = anthropicMessageToChatCompletion({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-5",
    container: null,
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [{ type: "tool_use", id: "call_1", caller: { type: "direct" }, name: "get_weather", input: { city: "Shanghai" } }],
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation: null,
      inference_geo: null,
      service_tier: null,
      server_tool_use: null,
    },
  } as any);

  assert.equal(result.choices[0].message.tool_calls?.[0].type, "function");
});

run("anthropic tool_result block array becomes chat tool text", () => {
  const result = anthropicMessageRequestToChatParams({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_1",
            content: [{ type: "text", text: "Sunny" }, { type: "text", text: "25C" }],
          },
        ],
      },
    ],
  });

  assert.equal(result.messages[0].role, "tool");
  assert.equal((result.messages[0] as { content: string }).content, "Sunny\n25C");
});

run("chat tool result round-trip through anthropic preserves tool id", () => {
  const anthropic = chatParamsToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_roundtrip",
            type: "function",
            function: { name: "lookup", arguments: "{\"q\":\"weather\"}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_roundtrip",
        content: "result text",
      },
    ],
  });

  const chat = anthropicMessageRequestToChatParams(anthropic);
  assert.equal((chat.messages[0] as { tool_calls: Array<{ id: string }> }).tool_calls[0].id, "call_roundtrip");
  assert.equal((chat.messages[1] as { tool_call_id: string }).tool_call_id, "call_roundtrip");
});

run("responses function call output round-trip through anthropic preserves call id", () => {
  const anthropic = responsesRequestToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    input: [{ type: "function_call_output", call_id: "resp_call", output: "ok" }],
  });

  const responses = anthropicMessageRequestToResponsesRequest(anthropic);
  assert.equal((responses.input as Array<{ call_id: string }>)[0].call_id, "resp_call");
});

run("chat parallel_tool_calls false survives anthropic conversion without explicit tool_choice", () => {
  const anthropic = chatParamsToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    parallel_tool_calls: false,
    messages: [{ role: "user", content: "weather?" }],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object", properties: { city: { type: "string" } } },
        },
      },
    ],
  });

  assert.equal((anthropic.tool_choice as any).type, "auto");
  assert.equal((anthropic.tool_choice as any).disable_parallel_tool_use, true);

  const chat = anthropicMessageRequestToChatParams(anthropic);
  assert.equal(chat.parallel_tool_calls, false);
});

run("anthropic disable_parallel_tool_use becomes responses parallel_tool_calls false", () => {
  const responses = anthropicMessageRequestToResponsesRequest({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    messages: [{ role: "user", content: "hi" }],
  } as any);

  assert.equal(responses.parallel_tool_calls, false);
});

run("chat response round-trip through anthropic preserves tool call name", () => {
  const anthropic = chatCompletionToAnthropicMessage({
    id: "chat_rt",
    object: "chat.completion",
    created: 2,
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls",
        logprobs: null,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "calling tool" }],
          refusal: null,
          tool_calls: [
            {
              id: "call_resp_rt",
              type: "function",
              function: { name: "lookup", arguments: "{\"q\":\"weather\"}" },
            },
          ],
        },
      },
    ],
  } as any);

  const chat = anthropicMessageToChatCompletion(anthropic);
  assert.equal((chat.choices[0].message.tool_calls?.[0] as any).function.name, "lookup");
});

run("anthropic request thinking block is preserved in responses request", () => {
  const responses = anthropicMessageRequestToResponsesRequest({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "I should call the weather tool.",
            signature: "sig_1",
          },
          {
            type: "text",
            text: "Let me check.",
          },
        ],
      },
    ],
  });

  const input = responses.input as Array<{ type: string }>;
  assert.equal(input[0].type, "reasoning");
  assert.equal((input[0] as any).content[0].text, "I should call the weather tool.");
  assert.equal(input[1].type, "message");
});

run("anthropic response thinking block is preserved in responses response", () => {
  const responses = anthropicMessageToResponsesResponse({
    id: "msg_thinking",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-5",
    container: null,
    stop_reason: "end_turn",
    stop_sequence: null,
    content: [
      {
        type: "thinking",
        thinking: "Need to reason first.",
        signature: "sig_resp",
      },
      {
        type: "text",
        text: "final answer",
        citations: null,
      },
    ],
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation: null,
      inference_geo: null,
      service_tier: null,
      server_tool_use: null,
    },
  } as any);

  assert.equal((responses.output[0] as any).type, "reasoning");
  assert.equal((responses.output[1] as any).type, "message");
});

run("anthropic thinking budget does not leak into chat reasoning_effort", () => {
  const chat = anthropicMessageRequestToChatParams({
    model: "claude-sonnet-4-5",
    max_tokens: 12000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    messages: [{ role: "user", content: "hi" }],
  } as any);

  assert.equal(chat.reasoning_effort, undefined);
});

run("anthropic thinking budget does not leak into responses reasoning.effort", () => {
  const responses = anthropicMessageRequestToResponsesRequest({
    model: "claude-sonnet-4-5",
    max_tokens: 12000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    messages: [{ role: "user", content: "hi" }],
  } as any);

  assert.equal((responses as any).reasoning, undefined);
});

runThrows("chat medium reasoning fails when anthropic max_tokens default is too small", () => {
  chatParamsToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    reasoning_effort: "medium",
    messages: [{ role: "user", content: "hi" }],
  });
}, "Anthropic thinking budget must be less than max_tokens");

runThrows("chat high reasoning fails when explicit anthropic max_tokens is too small", () => {
  chatParamsToAnthropicMessageRequest({
    model: "gpt-4o-mini",
    reasoning_effort: "high",
    max_completion_tokens: 5000,
    messages: [{ role: "user", content: "hi" }],
  });
}, "Anthropic thinking budget must be less than max_tokens");
