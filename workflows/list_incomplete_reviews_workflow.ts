import { DefineWorkflow, Schema } from 'deno-slack-sdk/mod.ts'
import { ListIncompleteReviewsFunction } from '../functions/list_incomplete_reviews_function.ts'

export const ListIncompleteReviewsWorkflow = DefineWorkflow({
  callback_id: 'list_incomplete_reviews_workflow',
  title: 'List Incomplete PR Reviews',
  description: 'List the Incomplete PR Code Reviews from your current channel.',
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity
      },
      channel_id: {
        type: Schema.slack.types.channel_id
      },
      user_id: {
        type: Schema.slack.types.user_id
      }
    },
    required: ['interactivity']
  }
})

ListIncompleteReviewsWorkflow.addStep(ListIncompleteReviewsFunction, {
  interactivity: ListIncompleteReviewsWorkflow.inputs.interactivity,
  channel_id: ListIncompleteReviewsWorkflow.inputs.channel_id,
  user_id: ListIncompleteReviewsWorkflow.inputs.user_id
})
