import { DefineWorkflow, Schema } from 'deno-slack-sdk/mod.ts'
import { CodeReviewFunction } from '../functions/code_review_function.ts'

const CodeReviewWorkflow = DefineWorkflow({
  callback_id: 'code_review_workflow',
  title: 'Begin a PR Code Review',
  description:
    'Input the details of your Pull Request and post a message to notify and begin a Pull Request Code Review.',
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity
      },
      channel: {
        type: Schema.slack.types.channel_id
      }
    },
    required: ['interactivity']
  }
})

const prForm = CodeReviewWorkflow.addStep(Schema.slack.functions.OpenForm, {
  title: 'Create Pull Request',
  interactivity: CodeReviewWorkflow.inputs.interactivity,
  submit_label: 'Begin Code Review',
  fields: {
    elements: [
      {
        name: 'priority',
        title: 'Priority',
        description:
          'The urgency of your pull request that dictates its priority when deciding which Pull Request should be reviewed.',
        type: Schema.types.string,
        enum: ['low', 'medium', 'high'],
        choices: [
          {
            value: 'low',
            title: '⚪️ Low Priority (Not Urgent)'
          },
          {
            value: 'medium',
            title: '🔵 Medium Priority (Timely)'
          },
          {
            value: 'high',
            title: '🔴 High Priority (Urgent)'
          }
        ],
        default: 'medium'
      },
      {
        name: 'issue_id',
        title: 'Issue ID',
        description: 'The ID of the issue (i.e. CCS-2425)',
        type: Schema.types.string
      },
      {
        name: 'pr_url',
        title: 'Pull Request URL',
        description: 'The URL that navigates to the Pull Request',
        type: Schema.types.string,
        format: 'url'
      },
      {
        name: 'pr_description',
        title: 'Pull Request Description',
        description:
          'An optional description that will be posted along with your Pull Request',
        type: Schema.types.string,
        long: true
      }
    ],
    required: ['issue_id', 'pr_url', 'priority']
  }
})

CodeReviewWorkflow.addStep(CodeReviewFunction, {
  interactivity: prForm.outputs.interactivity,
  channel: CodeReviewWorkflow.inputs.channel,
  priority: prForm.outputs.fields.priority,
  issue_id: prForm.outputs.fields.issue_id,
  pr_url: prForm.outputs.fields.pr_url,
  pr_description: prForm.outputs.fields.pr_description
})

export default CodeReviewWorkflow
