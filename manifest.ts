import { Manifest } from 'deno-slack-sdk/mod.ts'
import { OldestCodeReviewDatastore } from './datastores/oldest_code_review_datastore.ts'
import { CodeReviewEvent } from './event_types/code_review_event.ts'
import { CodeReviewFunction } from './functions/code_review_function.ts'
import { CodeReviewWorkflow } from './workflows/code_review_workflow.ts'
import { ListIncompleteReviewsFunction } from './functions/list_incomplete_reviews_function.ts'
import { ListIncompleteReviewsWorkflow } from './workflows/list_incomplete_reviews_workflow.ts'
import { ListUnapprovedReviewsFunction } from './functions/list_unapproved_reviews_function.ts'
import { ListUnapprovedReviewsWorkflow } from './workflows/list_unapproved_reviews_workflow.ts'

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/future/manifest
 */
export default Manifest({
  name: 'pr-bot',
  description: 'Manage Pull Request Code Reviews within Slack',
  displayName: 'PR Bot',
  icon: 'assets/logo.png',
  backgroundColor: '#235784',
  functions: [CodeReviewFunction, ListIncompleteReviewsFunction, ListUnapprovedReviewsFunction],
  workflows: [CodeReviewWorkflow, ListIncompleteReviewsWorkflow, ListUnapprovedReviewsWorkflow],
  events: [CodeReviewEvent],
  datastores: [OldestCodeReviewDatastore],
  outgoingDomains: [],
  botScopes: [
    'commands',
    'chat:write',
    'chat:write.public',
    'chat:write.customize',
    'groups:history',
    'groups:read',
    'datastore:read',
    'datastore:write'
  ],
  features: {
    appHome: {
      messagesTabEnabled: true,
      messagesTabReadOnlyEnabled: true
    }
  }
})
