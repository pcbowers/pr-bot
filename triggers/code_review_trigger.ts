import { Trigger } from 'deno-slack-api/types.ts'
import { CodeReviewWorkflow } from '../workflows/code_review_workflow.ts'

const CodeReviewTrigger: Trigger<typeof CodeReviewWorkflow.definition> = {
  type: 'shortcut',
  name: 'Begin a PR Code Review',
  description:
    'Input the details of your Pull Request and post a message to notify and begin a Pull Request Code Review.',
  workflow: '#/workflows/code_review_workflow',
  inputs: {
    interactivity: {
      value: '{{data.interactivity}}'
    },
    channel: {
      value: '{{data.channel_id}}'
    }
  }
}

export default CodeReviewTrigger
