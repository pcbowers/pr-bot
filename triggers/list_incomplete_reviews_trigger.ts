import { Trigger } from 'deno-slack-api/types.ts'
import { ListIncompleteReviewsWorkflow } from '../workflows/list_incomplete_reviews_workflow.ts'
import { TriggerContextData, TriggerTypes } from 'deno-slack-api/mod.ts'

const ListIncompleteReviewsTrigger: Trigger<typeof ListIncompleteReviewsWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: 'List Incomplete PR Reviews',
  description: 'List the Incomplete PR Code Reviews from your current channel.',
  workflow: '#/workflows/list_incomplete_reviews_workflow',
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

export default ListIncompleteReviewsTrigger
