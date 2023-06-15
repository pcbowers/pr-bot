import { Trigger } from 'deno-slack-api/types.ts'
import { ListUnapprovedReviewsFunction } from '../functions/list_unapproved_reviews_function.ts'
import { TriggerContextData, TriggerTypes } from 'deno-slack-api/mod.ts'

const ListUnapprovedReviewsTrigger: Trigger<typeof ListUnapprovedReviewsFunction.definition> = {
  type: TriggerTypes.Shortcut,
  name: 'List Unapproved PR Reviews',
  description: 'List the Unapproved PR Code Reviews from your current channel.',
  workflow: '#/workflows/list_unapproved_reviews_workflow',
  inputs: {
    interactivity: {
      value: TriggerContextData.Shortcut.interactivity
    },
    channel_id: {
      value: TriggerContextData.Shortcut.channel_id
    },
    user_id: {
      value: TriggerContextData.Shortcut.user_id
    }
  }
}

export default ListUnapprovedReviewsTrigger
