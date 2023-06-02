import { DefineFunction, Schema, SlackFunction } from 'deno-slack-sdk/mod.ts'
import { listReviews } from './code_review_list_reviews.ts'

export const ListIncompleteReviewsFunction = DefineFunction({
  callback_id: 'list_incomplete_reviews_function',
  title: 'List Incomplete PR Code Reviews',
  source_file: 'functions/list_incomplete_reviews_function.ts',
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel_id: { type: Schema.slack.types.channel_id },
      user_id: { type: Schema.slack.types.user_id }
    },
    required: ['interactivity', 'channel_id', 'user_id']
  },
  output_parameters: {
    properties: {
      count: { type: Schema.types.integer },
      reviews: {
        type: Schema.types.array,
        items: {
          type: Schema.types.string
        },
        default: []
      }
    },
    required: ['count', 'reviews']
  }
})

export default SlackFunction(ListIncompleteReviewsFunction, async ({ inputs, client }) => {
  return {
    outputs: await listReviews(client, inputs.user_id, inputs.channel_id)
  }
})
