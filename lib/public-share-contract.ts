export type PublicShareResourceType = 'artifact' | 'conversation'

export interface PublicShareResource {
  id: string
  type: PublicShareResourceType
}

export interface WorkspacePublicShare {
  canRevoke: boolean
  createdAt: string
  id: string
  publicId: string
}

export interface PublicArtifactSnapshot {
  content: string
  title: string
  type: 'artifact'
  version: 1
  workspaceName: string
}

export interface PublicConversationMessage {
  role: 'assistant' | 'user'
  text: string
}

export interface PublicConversationSnapshot {
  messages: PublicConversationMessage[]
  title: string
  type: 'conversation'
  version: 1
  workspaceName: string
}

export type PublicShareSnapshot = PublicArtifactSnapshot | PublicConversationSnapshot
