// Client-level re-export of the plan detail screen so that it can be pushed
// onto the client-level stack (from the Today tab) without entering the Plans
// tab stack. When reached via this route, router.back() and the iOS swipe-back
// gesture both pop back to the Today tab instead of landing on the Plans tab.
//
// DO NOT add body logic here. See app/(client)/(tabs)/plans/[planId].tsx for
// the implementation. Any changes to the detail screen belong there.
// Issue #425 owns localisation fixes in that file; #428 only adds this wrapper.
export { default } from './../(tabs)/plans/[planId]'
