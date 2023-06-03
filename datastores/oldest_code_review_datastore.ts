import { DefineDatastore, Schema } from 'deno-slack-sdk/mod.ts'

export const OldestCodeReviewDatastore = DefineDatastore({
  name: 'code_review_datastore',
  attributes: {
    id: {
      type: Schema.types.string
    },
    timestamp: {
      type: Schema.types.string
    }
  },
  primary_key: 'id'
})
