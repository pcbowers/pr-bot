import { DefineWorkflow, Schema } from 'deno-slack-sdk/mod.ts'
import { ListUnapprovedReviewsFunction } from '../functions/list_unapproved_reviews_function.ts'

export const ListUnapprovedReviewsWorkflow = DefineWorkflow({
  callback_id: 'list_unapproved_reviews_workflow',
  title: 'List Unapproved PR Reviews',
  description: 'List the Unapproved PR Code Reviews from your current channel.',
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
    required: ['interactivity', 'channel_id', 'user_id']
  }
})

ListUnapprovedReviewsWorkflow.addStep(ListUnapprovedReviewsFunction, {
  interactivity: ListUnapprovedReviewsWorkflow.inputs.interactivity,
  channel_id: ListUnapprovedReviewsWorkflow.inputs.channel_id,
  user_id: ListUnapprovedReviewsWorkflow.inputs.user_id
})

export default ListUnapprovedReviewsWorkflow
