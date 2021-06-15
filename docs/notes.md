Page management

Cohort
* On load, show list of current cohorts (if any)
* ‘Create cohort’ Button at top of page
    * Shows editable cohort page with blank fields
* On click of any:
    * Left sidebar with cohort options
        * Edit
        * Delete
        * Invite
    * Have return button in corner
    * List cohort properties in centre
    * List members in menu below information

Search
* On load, display search bar and taggable options
    * List all matches in self-contained divs
    * Allow filtering by area of expertise

Publications
* On main button click, dependent on login:
    * If not logged in, show splash screen ‘no publications, sign in to publish your papers’
    * If logged in, show user’s publications as centered list sorted by time posted
        * Button on left to post new
    * On click publication, take to view/manage publication
* View/Manage Publication
    * If not publisher, load View page
        * Abstract of publication on left/middle
            * Option to load entire thing
            * Citations listed on right
        * Reviews and comment threads below abstract
            * ‘Make a review’ box at the top of page
                * Filter reviews by date time posted or highest/lowest rating
            * Each review has <=2 comments, with box to add comment
            * “Back to top” button above ‘make a review’ box
    * If publisher, load Manage page
        * Show editable properties of publication at top of page
            * Re-upload, listed name, area, cohort, etc
        * Show abstract under properties, use left/middle of page
        * Show reviews/comments on right

Recent feed
* Login independent
* Centered, scrollable list of divs containing publication titles and clickable links
* Show rating(if any), title, upload date, author(s), abstract

User
* If logged in:
    * Show editable user name, list cohorts, list publications, list about user
* If not logged in:
    * Show splash ‘log in with google to create an account and get started!’
    * After logging in, show blank but editable name, about, blank publications, blank cohorts
* Allow to save


About
* List information about website
    * History, purpose, updates
* List contact info
    * Developer email
* List help articles
    * Axe this if not enough time

Notifications
* Right-side modal menu available at all times
* Lists recent activity
    * Reviews on user publications, comments on user reviews, invitations to cohorts
    * Message alerts if the time can be found to implement it

Chat/Message screen
* Only implement if time can be found

