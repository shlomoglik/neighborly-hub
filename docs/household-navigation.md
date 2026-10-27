# Household navigation

`/household/[id]/layout.tsx` authenticates the request and provides a persistent
`HouseholdLayout` for household details and family management. The existing URLs
are unchanged. Its project/household heading, breadcrumbs and permitted tabs stay
mounted while route loading boundaries replace only the content below them.

The layout owns one authenticated detail resource, also consumed by the details
page. Pagination and successful edits refresh this resource, including the heading.
Family management retains its separate authorized API. Its access failures also
clear the shared navigation; navigation access failures hide family content.

Breadcrumbs point to **My households** when `ownContacts !== null` (an existing
server indication of household membership), otherwise to **Directory**. The same context selects the active application
navigation item on desktop and mobile. The
family management tab follows the existing `canRename` representative capability;
server authorization remains authoritative for direct links and mutations.

Only this household resource opts into `usePrivateResource`'s same-key refresh
retention. Existing consumers still clear data during loading. Household changes,
hidden pages, failed reads and explicit access invalidation clear retained data.
There is no global or persistent client cache of household metadata.
