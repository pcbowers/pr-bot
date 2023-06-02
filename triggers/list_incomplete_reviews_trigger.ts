import { Trigger } from 'deno-slack-api/types.ts'
import { ListIncompleteReviewsWorkflow } from '../workflows/list_incomplete_reviews_workflow.ts'

const ListIncompleteReviewsTrigger: Trigger<typeof ListIncompleteReviewsWorkflow.definition> = {
  type: 'shortcut',
  name: 'List Incomplete PR Code Reviews',
  description: 'List the Incomplete PR Code Reviews from your current channel.',
  workflow: '#/workflows/list_incomplete_reviews_workflow',
  inputs: {
    interactivity: {
      value: '{{data.interactivity}}'
    },
    channel_id: {
      value: '{{data.channel_id}}'
    },
    user_id: {
      value: '{{data.user_id}}'
    }
  }
}

export default ListIncompleteReviewsTrigger
