import { type ClientSchema, a, defineData } from "@aws-amplify/backend";


const schema = /* GraphQL */`
  type Project
@auth(
rules: [
    {allow: public},
    { allow: private, operations: [read] }, #Signed in users can list projects 
    { allow: groups, groups: ["admin"] } #Only admins can create a Project
])
@model
{
    name: String! @primaryKey
    categories: [Category] @hasMany(indexName:"byProject", fields:["name"])
    annotationSet: [AnnotationSet] @hasMany(indexName:"byProject", fields:["name"])
    locationSets: [LocationSet] @hasMany(indexName:"byProject", fields:["name"])
    imageSets: [ImageSet] @hasMany(indexName:"byProject", fields:["name"])
    queues: [Queue] @hasMany (indexName:"byProject", fields:["name"])
    users: [UserProjectMembership] @hasMany (indexName:"byProject",fields:["name"])
}

type User
@auth(
rules: [
{ allow: private }, # Allows signed in users to modify this table. So admins can (re)assign users to queues and 
# promote/demote users to/from admin status.
{allow:public} #Allows access via API key so that the Lambda function can create new user's on login
# TODO : invetigate how to deal with API key expiry. There may be a way to set an API key to never expire, 
# alternatively we must have an automated key renewal strategy or use IAM authentication.
])
@model
{
  id: String! @primaryKey # This corresponds to the username
  name: String! # This corresponds to the user's "real name" or "full name"
  email: String
  isAdmin: Boolean
  projects: [UserProjectMembership] @hasMany (indexName:"byUser",fields:["id"])
  currentProjectId: String 
  currentProject : Project @hasOne(fields:["currentProjectId"]) 
}

type UserProjectMembership
@model
@auth(
rules: [
    {allow: public},
{ allow: private }
])
{
  userId: String! @index(name:"byUser")
  user: User @belongsTo(fields:["userId"])
  projectId : String! @index(name:"byProject")
  project: Project @belongsTo(fields:["projectId"])
  queueUrl : String @index(name:"byQueue")
  queue: Queue @belongsTo(fields:["queueUrl"]) 
}


type Queue @model @auth(rules: [{allow: public},
{ allow: private }]){
  name: String! 
  url: String! @primaryKey # Using the url as primary key avoids a second lookup in many cases where secondary tables are interested in the URL
  # Also while it may seem that queue names should be unique, they only 'need' to be unique on a per-project basis
  users: [UserProjectMembership] @hasMany (indexName:"byQueue",fields:["url"]) 
  projectId: String! @index(name:"byProject")
  project: Project @belongsTo(fields:["projectId"]) # A queue has to belong to a specific project or we will be pushing tasks to users who are ot authorised to access the 
  #images/annotations
}

type Category
@model 
@auth(
rules: [
    {allow: public},
    { allow: groups, groups: ["admin"] } #Only admins can create a category
    { allow: private, operations: [read] }, #Signed in users can list categories 
    { allow: groups, groupsField: "projectID", operations: [read]  } # Allow members of the project to see this object
])
{
  id : ID! @primaryKey
  name:String! # It may be tempting to make the name of the category the primary key, but names only need to be unique on a per-project basis
  # It may be a useful convention to incorporate the name (at the time of creation) of a category into the id and possibly to enforce immutability 
  # of names
  color: String
  shortcutKey: String
  annotations: [Annotation] @hasMany (indexName:"byCategory",fields:["id"])
  objects: [Object] @hasMany (indexName:"byCategory",fields:["id"])
  projectName: String! @index(name:"byProject")
  project: Project @belongsTo (fields:["projectName"])
}

type AnnotationSet
@model
@auth(
rules: [
    {allow: public},
    { allow: private, operations: [read] }, #Signed in users can list AnnotationSets 
  { allow: groups, groups: ["admin"] } #In order to create a new Image object, you need to belong to the admin group.
])
{
  id:ID! @primaryKey
  name: String 
  projectName: String! @index(name:"byProject")
  project: Project @belongsTo (fields:["projectName"])
  annotations: [Annotation] @hasMany (indexName:"byAnnotationSet",fields:["id"])
  observations: [Observation] @hasMany  (indexName:"byAnnotationSet",fields:["id"])
}


type Annotation 
    @model  
    @auth(
    rules: [
      {allow: public},
      { allow: private},
      # Allow any signed in user to create an annotation and to delete or edit annotations that they themselves made. 
      { allow: groups, groups: ["superAdmin"] } # Allow superAdmins to do everything
      { allow: groups, groupsField: "readGroup", operations: [read]  } # Allow members of the designated group to see this object
      { allow: groups, groupsField: "writeGroup"} # Allow members of the designated group to edit/delete this object
    ])
{
  x: Int!
  y: Int!
  obscured: Boolean
  note: String
  origin: String
  imageKey: String! @index(name:"byImage")
  image: Image @belongsTo(fields:["imageKey"])
  annotationSetId: ID! @index(name:"byAnnotationSet") 
  annotationSet: AnnotationSet @belongsTo (fields:["annotationSetId"])
  categoryId: ID! @index(name:"byCategory")
  category: Category @belongsTo (fields:["categoryId"])
  objectId: ID @index(name:"byObject")
  object: Object @belongsTo (fields:["objectId"])
  owner: String
  #TODO : Prevent re-assignment https://docs.amplify.aws/cli/graphql/authorization-rules/#per-user--owner-based-data-access
}

type Object
    @model
    @auth(
    rules: [
      {allow: public},
      { allow: groups, groups: ["admin"] } # Allow admins to create new objects
          { allow: groups, groupsField: "readGroup", operations: [read]  } # Allow members of the designated group to see the objects
    ])
{
  categoryId: ID! @index(name:"byCategory")
  category: Category @belongsTo (fields:["categoryId"])
  latitude: Float
  longitude: Float
  annotations: [Annotation] @hasMany (indexName:"byObject")
}

type Image 
    @model 
    @auth(
    rules: [
      { allow: private, operations: [read] }, #Signed in users can list images
      { allow: groups, groups: ["admin"] } #In order to create a new Image object, you need to belong to the admin group.
      {allow:public} #Allows access via API key so that the Lambda function can create new user's on login
# TODO : invetigate how to deal with API key expiry. There may be a way to set an API key to never expire, 
# alternatively we must have an automated key renewal strategy or use IAM authentication.
    ])
{
  key: String! @primaryKey
  hash: String 
  width: Int
  height: Int
  longitude: Float
  latitude:Float
  altitude_msl: Float
  roll: Float
  yaw: Float
  pitch: Float
  timestamp: Float 
  altitude_agl: Float
  exifData: String
  cameraSerial: String
  annotations: [Annotation] @hasMany (indexName:"byImage",fields:["key"])
  locations: [Location] @hasMany (indexName:"byImage",fields:["key"])
  collections: [ImageSet] @manyToMany(relationName: "ImageSetMembership")
  leftNeighbours: [ImageNeighbour] @hasMany(indexName:"bySecondNeighbour",fields:["key"]) 
  rightNeighbours: [ImageNeighbour] @hasMany(indexName:"byFirstNeighbour",fields:["key"]) 
}

type ImageNeighbour 
  @model
  @auth(
  rules: [
    {allow: public},
    {allow: private},
    { allow: groups, groups: ["admin"] }  
  ])
{
 image1key: String! @index(name:"byFirstNeighbour")
 image1: Image @belongsTo (fields: ["image1key"])
 image2key: String! @index(name:"bySecondNeighbour")
 image2: Image @belongsTo (fields: ["image2key"])
 homography: [Float] 
}

type ImageSet
@model
@auth(
rules: [
    { allow: groups, groups: ["admin"] }, 
    { allow: groups, groupsField: "readGroup", operations: [read]  },
    {allow:public} #Allows access via API key so that the Lambda function can create new user's on login
# TODO : invetigate how to deal with API key expiry. There may be a way to set an API key to never expire, 
# alternatively we must have an automated key renewal strategy or use IAM authentication.
 
])
{
    name: String! @primaryKey
    images: [Image] @manyToMany(relationName: "ImageSetMembership")
    projectName: String! @index(name:"byProject")
    project: Project @belongsTo (fields:["projectName"])
}

type LocationSet
@model
@auth(rules: [
    {allow: public},
    {allow:private},
    { allow: groups, groups: ["admin"]} #In order to create a new LocationSet object.
])
{
    id:ID!@primaryKey
    name: String
    readGroup: String    
    locations: [Location] @hasMany(indexName:"bySet",fields:["id"])
    projectName: String! @index(name:"byProject")
    project: Project @belongsTo (fields:["projectName"])
}


type Location
@model
@auth(rules: [
    {allow: public},
    {allow:private},
    { allow: groups, groups: ["admin"] } #In order to create a new Location object, you need to belong to the admin group.
])
{
    id : ID! @primaryKey 
    setId: ID! @index(name:"bySet") @index(name:"testIndex",sortKeyFields:["isTest"],queryField:"testLocations")
    set: LocationSet @belongsTo(fields:["setId"])
    confidence : Float
    isTest : Int 
    imageKey : String! @index(name:"byImage")
    image: Image @belongsTo(fields:["imageKey"])
    observations: [Observation] @hasMany (indexName:"byLocation",fields:["id"])
    x: Int!
    y: Int!
    width : Int
    height: Int
}

type Observation
@model
@auth(rules: [
    {allow: public},
    {allow:private},
  { allow: groups, groups: ["admin"] }])
{
    locationId: ID! @index(name:"byLocation") @index(sortKeyFields:["owner","createdAt"])
    location: Location @belongsTo (fields:["locationId"])
    annotationSetId: ID! @index(name:"byAnnotationSet") 
    annotationSet: AnnotationSet @belongsTo (fields:["annotationSetId"])
    owner: String @index(name:"byOwner",sortKeyFields:["createdAt"]) 
    createdAt: AWSDateTime!
}
`;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },  
});
/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
