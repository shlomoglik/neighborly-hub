# Neighborly Hub product vision

> Neighborly Hub — הופכים שכנות לקהילה.
> Turning neighbors into a community.

This is the canonical product vision. It guides product decisions; it is not a
feature inventory, delivery schedule or implementation commitment. The concise,
localized public version lives at `/vision`.

## Mission

Connect people and families in residential communities, particularly urban
neighborhoods, through meaningful relationships, mutual assistance, knowledge
sharing and local opportunities. The digital neighborhood directory is the
starting point; stronger human connections are the goal.

## Product principles

1. **People first.** Separate personal identity, households, physical properties
   and community memberships. These represent different relationships and should
   not be treated as interchangeable.
2. **Community independence.** Communities belong to their members, not their
   creators, managers or commercial providers.
3. **Connected communities.** Buildings, residential complexes and neighborhoods
   may form independent but related communities.
4. **Identity and privacy.** One user identity can participate in multiple
   communities with community-specific profile visibility and permissions.
5. **Membership by affiliation.** Residents, owners, former residents and relevant
   service providers can have different relationships with communities.
6. **Privacy by design.** Individuals control their personal information.
   Administrative access is purpose-limited, not unrestricted permission to use or
   publish residents' information.
7. **Community participation.** Communities may have central activity spaces and
   optional interest groups.
8. **Community governance.** Members can generate ordinary content; official
   information requires appropriate authorization.
9. **Commercial neutrality.** Encourage discovery of useful local services without
   becoming an advertising platform.
10. **Continuous learning.** Prioritize real community needs and feedback over
    speculative feature development.

These principles describe the intended product model. They do not assert that all
corresponding entities, permissions or workflows already exist in the application.

## Long-term product layers

| Layer                  | Direction                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Community Directory    | People, families, households, interests, skills and relevant local services.                 |
| Community Hub          | Events, mutual assistance, opportunities, knowledge and community activity.                  |
| Community Intelligence | User-initiated knowledge capture, search and relevant recommendations.                       |
| Community Extensions   | Optional paid modules for management companies, organizations and independent professionals. |

These layers are a long-term direction, not a promise of current functionality.
The community core should remain free for community members. Commercial modules
sell useful operational capabilities, not advertising exposure or access to
residents' private data.

## WhatsApp vision: future research only

A proposed integration would use one centralized Neighborly Bot serving multiple
communities. Multiple WhatsApp groups could map to different community spaces.
The bot would act only following an explicit mention or user request.

Public replies would contain appropriate general information. Sensitive actions,
publication scope and approvals would use private interactions or secure
application links. Mentioning the bot would **not** authorize publishing another
person's personal information.

Technical feasibility, WhatsApp API limitations and legal/privacy requirements
remain open research questions. This vision does not establish feasibility or
permission to process group conversations. No WhatsApp bot integration is
implemented as part of this documentation work.

## MVP and pilot

The first pilot is planned for a new residential building complex.

- **Primary objective:** Help neighbors discover and get to know each other through
  a digital neighborhood directory.
- **Secondary objective:** Learn what the community needs through feedback and
  surveys.

MVP priorities, rather than a statement that every item is already delivered:

- Community, building and apartment setup.
- Invitations and membership onboarding.
- Individual and household profiles.
- Neighborhood directory and search.
- Privacy and permissions.
- Product feedback collection.
- Basic surveys and results.

The pilot follows shared governance: the product team owns product research and
improvements; community representatives support onboarding and community
engagement. Feedback should guide small, practical improvements.

## Current implementation and scope boundaries

The application already has authenticated live directory and search flows,
project/building/apartment setup, invitations, scoped membership and management
access, household profiles and privacy enforcement. See the [README](../README.md)
for current setup and implementation status; the repository code remains the
source of truth for exact behavior.

The MVP priorities above include further work. In particular, feedback collection
and surveys are goals, not functionality introduced by this PR. Community activity
spaces, Community Intelligence, paid extensions and the proposed WhatsApp bot are
future directions. Existing direct WhatsApp contact links are not a bot integration.

Publishing this vision does not change database entities, community structure,
authentication or authorization, and does not implement any of those future
capabilities.
