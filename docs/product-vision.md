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

1. **People before properties.** Personal identity, households, physical properties
   and community memberships are separate concepts. A person may live alone, with
   family or with roommates; their relationship with a property may change over time.
2. **Community independence.** Communities belong to their members, not their
   creators, managers or service providers. Community governance defines authority,
   manager succession and continuity.
3. **Connected communities.** Buildings, residential complexes and neighborhoods
   may form independent but related communities. Memberships and permissions do
   not transfer automatically between them.
4. **One identity, contextual visibility.** One account has community-specific
   profile visibility and permissions. Residents, owners, former residents and
   relevant service providers may have different affiliations. Former residents
   may retain a connection according to community policy.
5. **Privacy by design.** Individuals control their personal information;
   administrative access serves a defined purpose. Children's details receive
   special protection. Community data must not be used for marketing without an
   appropriate basis and consent.
6. **Open discovery, controlled membership.** Community policy determines
   discoverability, affiliation verification, joining and content visibility.
7. **Participation from within the community.** Central spaces and optional
   interest groups may be created independently or with approval, according to
   community policy. Members generate ordinary content; official information
   requires appropriate authorization.
8. **Technology supports human connections.** WhatsApp remains a communication
   channel. The platform organizes knowledge and activity without becoming an
   addictive feed or an advertising destination. It should also help members
   discover useful local services.
9. **An economy that serves the community.** The community core stays free.
   Organizations and professionals may pay for optional tools and services, not
   forced exposure or access to personal information.
10. **Continuous learning.** Prioritize real needs, feedback, surveys and measures
    of community value over speculative development or usage frequency alone.

These principles describe the intended product model. They do not assert that all
corresponding entities, permissions or workflows already exist in the application.

## Long-term product layers

| Layer                  | Direction                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community Directory    | People, families, households, interests, skills and relevant local services; search subject to privacy.                                                                                                                           |
| Community Hub          | A personalized home with combined content from selected communities and a single-community view; events, requests, offers, mutual assistance and interest groups.                                                                 |
| Community Intelligence | User-initiated knowledge capture, search, relevant recommendations and opportunities from content people choose to share; distinguish proposed, published, verified and expired information.                                      |
| Community Extensions   | Optional paid tools such as management-company service requests, collections and professional services. Activation in an existing community requires an authorized representative's approval; providers do not own the community. |

**Notifications:** Essential notifications by default. Community activity,
channels, frequency and quiet hours remain under user control.

These layers are a long-term direction, not a promise of current functionality.
The community core should remain free for community members. Commercial modules
sell useful operational capabilities, not advertising exposure or access to
residents' private data.

## WhatsApp vision: future research only

A proposed integration would use one centralized Neighborly Bot serving multiple
communities, with separate context and permissions for each community and group.
Multiple WhatsApp groups could map to different community spaces. The bot would
act **only following an explicit mention**. It would not initiate suggestions or
scan conversations for automatic indexing.

Public replies would contain appropriate general information. Sensitive actions,
publication scope and approvals would use private interactions or secure
application links. Mentioning the bot would **not** authorize publishing another
person's personal information.

Technical feasibility, WhatsApp API limitations and legal/privacy requirements
remain open research questions, including support for existing groups, sending
messages and compliance with the API terms of use. This vision does not establish feasibility or
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
- Free-text product feedback collection for the Neighborly Hub product team.
- Basic community surveys and results for authorized community representatives.

The pilot follows shared governance: the product team owns product research and
improvements; community representatives support onboarding and community
engagement and community governance. Product feedback and community surveys have
different audiences and responsibilities. Success is assessed through use of the
directory, new connections between neighbors, feedback participation and insights
that guide development, rather than usage frequency alone.

## Outside the initial MVP

Full internal chat, a WhatsApp bot, an automated Intelligence engine, general
plugin infrastructure, advanced commerce and rich interest groups are outside the
initial MVP. Allow gradual growth without building speculative infrastructure.

## Decisions still requiring research

- Quantitative success measures and pilot duration.
- Exact residency verification, representative permissions and authority transfer.
- Initial survey scope and question types, anonymity and data retention.
- Legal and technical feasibility of a bot connected to existing WhatsApp groups.
- Pricing and commercial terms for future extensions.

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
