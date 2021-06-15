create extension if not exists "uuid-ossp";

drop table if exists userData;
drop table if exists areaData;
drop table if exists cohortData;
drop table if exists publicationData;
drop table if exists citationData;
drop table if exists reviewData;
drop table if exists commentData;
drop table if exists cohortUser;
drop table if exists userArea;

create table userData (
    userID text not null unique, 
    userDisplayName varchar(30) unique,
    userFname varchar(30), 
    userLname varchar(30), 
    userEmail varchar(80),
    userAvatar text,
    userAbout varchar(500),
    primary key (userID)
);

create table areaData (
    areaID int primary key,
    areaName varchar(60) not null
);

create table cohortData (
    cohortID uuid default uuid_generate_v4(),
    cohortName varchar(60) not null unique, 
    cohortBirthday date not null default CURRENT_DATE, 
    cohortDesc varchar(500), 
    cohortAvatar text,
    cohortAdmin text references userData(userID) on delete cascade not null,
    primary key (cohortID) 
);

create table publicationData (
    publishID uuid primary key, 
    publishTitle varchar(150) not null,
    publishUser text references userData(userID) on delete cascade not null, 
    publishLink text,
    publishPath text, 
    publishAbstract varchar(500),
    publishArea int references areaData(areaID),
    publishCohort uuid references cohortData(cohortID) on delete cascade, 
    publishTimestamp timestamp not null default CURRENT_TIMESTAMP
);

create table citationData (
    citationID uuid default uuid_generate_v4(),
    citationLink text not null, 
    citationText varchar(150) not null,
    citationPublish uuid references publicationData(publishID) on delete cascade,
    primary key (citationID)
);

create table reviewData (
    reviewID uuid default uuid_generate_v4(), 
    reviewPublish uuid references publicationData(publishID) on delete cascade, 
    reviewContent text, 
    reviewTimestamp timestamp not null default CURRENT_TIMESTAMP, 
    reviewPoster text references userData(userID) on delete cascade, 
    reviewOf5 int not null, 
    primary key (reviewID)
);

create table commentData (
    commentID uuid default uuid_generate_v4(), 
    reviewID uuid references reviewData(reviewID) on delete cascade, 
    commentPoster text references userData(userID) on delete cascade, 
    commentContent text not null, 
    commentTimestamp timestamp not null default CURRENT_TIMESTAMP,
    primary key (commentID)
); 

create table cohortUser (
    cohortLinkID uuid references cohortData(cohortID) on delete cascade, 
    userLinkID text references userData(userID) on delete cascade
);

create table notificationData (
    notifID uuid primary key,
    notifTimeStamp timestamp not null default CURRENT_TIMESTAMP,
    notifType varchar(7) not null,
    notifSenderUser text references userData(userID) on delete cascade,
    notifSenderCohort uuid references cohortData(cohortID) on delete cascade,
    notifPublish uuid references publicationData(publishID) on delete cascade,
    notifReview uuid references reviewData(reviewID) on delete cascade,
    notifRecipient text references userData(userID) on delete cascade
);

--all queries below are purely to set the app up with dummy data for demonstration purposes and are not necessary for a public release.
--in fact i couldn't imagine putting this dummy data into a public release of any app, let alone this one
--this is purely because i don't think people would appreciate my sense of humour, rather than for any professional reasons, but. yeah
--http://www.example.com is used for every external link entry due to online safety concerns during demonstration and because it's copyright-free
--images used are either my creation or sourced from Xbox's public library of gamerpics
--titles of papers are all my creation, citation titles are freely referencable, documents are of my own creation
--references to persons, real or fictitious, are satirical and not representative of the persons

insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('109482631893680196465', 'Travlaad', 'Jack', 'Travis', null, 'avatar/cH2khds.png', 'Developer of the app and general madlad. Does his absolute best, but results may vary.');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('654893486540854670707', 'UoP_Dr_X', 'Doctor', 'Exx', 'uop@reviewme.com', 'avatar/6OW6fso.png', 'An example user, in disguise from an educational institution. It could even be you!');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('091775439571820759347', 'SeriousAcademic', 'Mr', 'Serious', 'veryserious@reviewme.com', 'avatar/cjhhuHI.png', 'An example user, who as the name implies, is quite serious. Wants all the good reviews and will work hard to get them.');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('317560135767401625400', 'NotSoSeriousAcademic', 'Mr', 'Notserious', 'verynotserious@reviewme.com', 'avatar/jy1qRkS.png', 'An example user, who as the name implies, is not that serious.');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('093128635864912468359', 'EvilInc', 'Ketchup', 'Goofenschmirtz', 'gamertag@reviewme.com', 'avatar/ObEPeIr.png', 'An example user: loving father, enterprising engineer, has a catchy jingle and is arch nemesis of a certain fedora-sporting platypus.');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('975403178459834187652', '104DaysofSummer', 'Phoneas', 'Frob', 'readytopeer@reviewme.com', 'avatar/trj1vJ7.png', 'An example user; joint account for two enterprising brothers who seem to know their stuff, alongside their pet platypus.');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('895234861349023632597', 'NotMarkiplier', 'Mark', 'Fishbach', 'madlad@reviewme.com', 'avatar/v8yhg3G.png', 'An example user, definitely not Markiplier; absolutely not no why would you think that');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('132785234083458612349', 'Travdaad', 'Michael', 'Lee', '5outof5@reviewme.com', 'avatar/GFZepfk.png', 'An example user, dad-est dad that ever dadded. Asked to be included as a user when I showed him the coursework in development. How could I say no?');
insert into userData (userID, userDisplayName, userFname, userLname, userEmail, userAvatar, userAbout) 
  values ('435784230825786347890', 'LocalBarbarian', 'Rajang', 'Has no last name', 'sandvichenthusiast@reviewme.com', 'avatar/vH69Zbc.png', 'An example user, and the app developer''s personal Dungeons and Dragons character. Being a barbarian with an Intelligence stat of -3, one might think he''s a bit out of his depth here; he is however not one to back down from a challenge.');

insert into areaData (areaID, areaName) values (1, 'Physics');
insert into areaData (areaID, areaName) values (2, 'Chemistry');
insert into areaData (areaID, areaName) values (3, 'English Literature');
insert into areaData (areaID, areaName) values (4, 'Biology');
insert into areaData (areaID, areaName) values (5, 'Psychology');
insert into areaData (areaID, areaName) values (6, 'Education and Teaching');
insert into areaData (areaID, areaName) values (7, 'Software Engineering');
insert into areaData (areaID, areaName) values (8, 'Madladdery');
insert into areaData (areaID, areaName) values (9, 'Marine Biology');
insert into areaData (areaID, areaName) values (10, 'Japanese Literature');

insert into cohortData (cohortName, cohortDesc, cohortAvatar, cohortAdmin) values 
  ('Bill Nye''s Science Crew', 'Bill Nye doesn''t actually use this cohort, but we swear we know him! We publish papers in all areas of science.', 'avatar/65DEaaD.png', '091775439571820759347');
insert into cohortData (cohortName, cohortDesc, cohortAvatar, cohortAdmin) values 
  ('UoP SoftEng', 'Cohort for Software Engineering students at the University of Portsmouth. Expect final year project ideas, research papers, app write-ups and bean pictures.', 'avatar/G9x3h3G.png', '654893486540854670707');
insert into cohortData (cohortName, cohortDesc, cohortAvatar, cohortAdmin) values 
  ('TravHort', 'Cohort for Travs and Trav related things. Publishes papers mostly relating to Madladdery, but sometimes branches out.', 'avatar/cH2khds.png', '109482631893680196465');

insert into cohortUser (userLinkID) values ('109482631893680196465');
insert into cohortUser (userLinkID) values ('132785234083458612349');
insert into cohortUser (userLinkID) values ('654893486540854670707');
insert into cohortUser (userLinkID) values ('091775439571820759347');
insert into cohortUser (userLinkID) values ('317560135767401625400');

with subquery as (select cohortID from cohortData where cohortName = 'TravHort') 
  update cohortUser set cohortLinkID = subquery.cohortID from subquery where userLinkID = '109482631893680196465';
with subquery as (select cohortID from cohortData where cohortName = 'TravHort') 
  update cohortUser set cohortLinkID = subquery.cohortID from subquery where userLinkID = '132785234083458612349';
with subquery as (select cohortID from cohortData where cohortName = 'UoP SoftEng') 
  update cohortUser set cohortLinkID = subquery.cohortID from subquery where userLinkID = '654893486540854670707';
with subquery as (select cohortID from cohortData where cohortName = 'Bill Nye''s Science Crew') 
  update cohortUser set cohortLinkID = subquery.cohortID from subquery where userLinkID = '091775439571820759347';
with subquery as (select cohortID from cohortData where cohortName = 'Bill Nye''s Science Crew') 
  update cohortUser set cohortLinkID = subquery.cohortID from subquery where userLinkID = '317560135767401625400';


insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('b18601a0-b5b9-427a-bd64-f84ebe004c48', 'How to Maintain a University Discord', '654893486540854670707', null, 'publish/toh4abgqzjw4w47zove3ffp657bak8l2.pdf', 7, null, 'During these pandemic times, mass communication with students is now one of the largest challenges educators face. Discord has the potential to be a fantastic learning tool for students, and through this paper we''ll explain how.');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract)  
  values ('0531c79b-ada5-43a8-85cd-7d573cd108c9', 'Presenting innovative and effective teaching practices for online learning', '654893486540854670707', 'http://www.example.com', null, 6, null, 'With the world moving to online learning due to the pandemic, and student retention and motivation falling on average due to this, it is important that educators find better ways to keep engagement rates to a satisfactory level.');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('fcdc5a74-e101-4227-b90d-f843c12a4775', 'Assessing Muons in Subatomic Interactions', '091775439571820759347', null, 'publish/s76ugq9q1dwzuizp3uiupo5485rv68st.pdf', 1, null, 'The muon is an elementary particle similar to the electron, with an electric charge of −1 e and a spin of 1/2, but with a much greater mass');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('a676d3ef-285f-41ff-a9f6-433f79624dd9', 'The Effects of Sodium Chlorite, a fake "Miracle Cure", on the Human Body', '091775439571820759347', null, 'publish/yv0ap75a1s7vnewjxiipdu93a0uvs6dz.pdf', 2, null, 'Sodium chlorite — also referred to as chlorous acid, sodium salt textone, and Miracle Mineral Solution — is composed of sodium (Na), chlorine (Cl), and oxygen (O2).');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('d869e047-ca7a-44d0-976c-a21b83ceca83', 'Why do things keep evolving into crabs?', '317560135767401625400', 'http://www.example.com', null, 4, null, 'When you think of the word crab, the first thing that pops into your head is probably something that looks like a blue, king, or Dungeness crab. Their look is unique and therefore memorable');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('861bb636-764a-4f3e-929f-e755e0be6629', 'The Long-term Effects on English after years of suffixing words with -inator', '093128635864912468359', null, 'publish/twdm6icf2q4z62s0yf0d09wawkqs6tsa.pdf', 3, null, 'Suffixing a word with "-inator" is not a hitherto common practice, but when attached to a predicate verb/action, can become a noun to reference a device used to perform the verb/action.');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('db935910-05f0-4d73-be88-38de62639bac', 'A Comprehensive Analysis on keeping a Duck-billed Platypus as a pet', '975403178459834187652', null, 'publish/zggl1ug6dsyh5rz94b6ul6gt0nn2ccme.pdf', 9, null, 'All platypus are classified as a protected species in Australia. In this paper, we will cover how we are now wanted men in Australian courts of law.');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('cfc4677d-68bf-48aa-9ff7-d5ca842269b3', 'Common Techniques used when pretending to be someone else: An Analysis', '895234861349023632597', null, 'publish/arso9yagw8r5ah5aat9xhiuh0sm5w22y.pdf', 5, null, 'Hello everybody! Not-Markiplier here and in this paper we''re gonna be learning why I''m a master of all disguise and how to trick people in the same way as I do.');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('7a3d82af-d15c-467d-8336-8342ced3168b', 'English for Barbarians', '435784230825786347890', null, 'publish/vjysbkdujecmem5jyf25l4s5klf20gcy.pdf', 3, null, 'As barbarian, English not good speak of mine. But, I do best to write paper to help other barbarians in same place, and teach about English past.');
insert into publicationData (publishID, publishTitle, publishUser, publishLink, publishPath, publishArea, publishCohort, publishAbstract) 
  values ('f03c4c7a-c20f-4ab7-86d2-eb6d55514cfb', 'Life as a Northern Englishman: A History', '109482631893680196465', null, 'publish/d7ak57kln0ayne6uj3zk4vrs4jtjsvjm.pdf', 8, null, '23 years since being born in the northeast');

with subquery as (select cohortID from cohortData where cohortName = 'Bill Nye''s Science Crew') 
  update publicationData set publishCohort = subquery.cohortID from subquery where publishUser = '091775439571820759347';
with subquery as (select cohortID from cohortData where cohortName = 'Bill Nye''s Science Crew') 
  update publicationData set publishCohort = subquery.cohortID from subquery where publishUser = '317560135767401625400';
with subquery as (select cohortID from cohortData where cohortName = 'UoP SoftEng') 
  update publicationData set publishCohort = subquery.cohortID from subquery where publishUser = '654893486540854670707';
with subquery as (select cohortID from cohortData where cohortName = 'TravHort') 
  update publicationData set publishCohort = subquery.cohortID from subquery where publishUser = '109482631893680196465';

insert into citationData (citationLink, citationText, citationPublish) values 
  ('https://www.example.com', 'A Complete Historical Account of Greggs'' Sausage Rolls and their economic impact on the North-East of England', 'f03c4c7a-c20f-4ab7-86d2-eb6d55514cfb');
insert into citationData (citationLink, citationText, citationPublish) values 
  ('https://www.example.com', 'Kurzgesagt''s Youtube video on the matter', 'fcdc5a74-e101-4227-b90d-f843c12a4775');
insert into citationData (citationLink, citationText, citationPublish) values  
  ('https://www.example.com', 'Discord''s instructional guide on the tools teachers have to create and manage a student server', 'b18601a0-b5b9-427a-bd64-f84ebe004c48');
insert into citationData (citationLink, citationText, citationPublish) values 
  ('https://www.example.com', 'Carcinization in the Anomura – fact or fiction? Evidence from adult morphology', 'd869e047-ca7a-44d0-976c-a21b83ceca83');
insert into citationData (citationLink, citationText, citationPublish) values 
  ('https://www.example.com', 'Ornithorhynchus anatinus". IUCN Red List of Threatened Species.', 'db935910-05f0-4d73-be88-38de62639bac');
insert into citationData (citationLink, citationText, citationPublish) values 
  ('https://www.example.com', 'Clinical Toxicology of Commercial Products: Williams and Witkins 5th Edition', 'a676d3ef-285f-41ff-a9f6-433f79624dd9');

insert into reviewData (reviewPublish, reviewContent, reviewPoster, reviewOf5)
  values ('f03c4c7a-c20f-4ab7-86d2-eb6d55514cfb', 'Fantastic paper, really enjoyed the read. The part about Thatcher quite dragged but otherwise top stuff.', '132785234083458612349', 5);
insert into reviewData (reviewPublish, reviewContent, reviewPoster, reviewOf5)
  values ('b18601a0-b5b9-427a-bd64-f84ebe004c48', 'I had never even entertained the thought of using Discord as a method of keeping teachers and students connected but this paper has really changed my mind on it! Very informative and well pieced.', '091775439571820759347', 5);
insert into reviewData (reviewPublish, reviewContent, reviewPoster, reviewOf5)
  values ('7a3d82af-d15c-467d-8336-8342ced3168b', 'Thank for paper, us barbarian not need such trouble with English. Very good. Made nice break from fighting', '435784230825786347890', 4);
insert into reviewData (reviewPublish, reviewContent, reviewPoster, reviewOf5)
  values ('db935910-05f0-4d73-be88-38de62639bac', '*platypus noises*', '975403178459834187652', 3);
insert into reviewData (reviewPublish, reviewContent, reviewPoster, reviewOf5)
  values ('fcdc5a74-e101-4227-b90d-f843c12a4775', 'Muons are such a difficult concept to grasp for most people, and the way you structured not only the information in this paper, but the prose with which you presented it... didn''t reduce the difficulty in the slightest. Has its good points, but worth a going over with a red pen.', '654893486540854670707', 2);

insert into commentData (reviewID, commentPoster, commentContent)
  values (null, '109482631893680196465', 'Thanks dad, means a lot!');
insert into commentData (reviewID, commentPoster, commentContent)
  values (null, '093128635864912468359', 'Thank you for the insight, Perry the Platypus.');
insert into commentData (reviewID, commentPoster, commentContent)
  values (null, '091775439571820759347', 'Thank you for the review. I am more than happy to work off of any further feedback you would like to impart.');
insert into commentData (reviewID, commentPoster, commentContent)
  values (null, '975403178459834187652', '*sassy platypus noises*');  

with subquery as (select reviewID from reviewData where reviewPoster = '132785234083458612349') 
  update commentData set reviewID = subquery.reviewID from subquery where commentPoster = '109482631893680196465';
with subquery as (select reviewID from reviewData where reviewPoster = '975403178459834187652') 
  update commentData set reviewID = subquery.reviewID from subquery where commentPoster = '093128635864912468359';
with subquery as (select reviewID from reviewData where reviewPoster = '654893486540854670707') 
  update commentData set reviewID = subquery.reviewID from subquery where commentPoster = '091775439571820759347';
with subquery as (select reviewID from reviewData where reviewPoster = '091775439571820759347') 
  update commentData set reviewID = subquery.reviewID from subquery where commentPoster = '975403178459834187652';

insert into notificationData(notifID, notifType, notifSenderUser, notifSenderCohort, notifPublish, notifReview, notifRecipient) values
  ('2abd3732-5e06-4327-8e5a-4127ad83f092', 'welcome', null, null, null, null, '109482631893680196465');
insert into notificationData(notifID, notifType, notifSenderUser, notifSenderCohort, notifPublish, notifReview, notifRecipient) values
  ('696072f2-bd58-4bcc-a2f9-9e915ca6c72c', 'invite', '654893486540854670707', null, null, null, '109482631893680196465');
insert into notificationData(notifID, notifType, notifSenderUser, notifSenderCohort, notifPublish, notifReview, notifRecipient) values
  ('ceeeda28-e7ef-44ee-93d0-816344b46c70', 'review', '132785234083458612349', null, 'f03c4c7a-c20f-4ab7-86d2-eb6d55514cfb', null, '109482631893680196465');
insert into notificationData(notifID, notifType, notifSenderUser, notifSenderCohort, notifPublish, notifReview, notifRecipient) values
  ('456e756a-691e-4e7f-83e1-eceea62eb4f3', 'comment', '093128635864912468359', null, 'f03c4c7a-c20f-4ab7-86d2-eb6d55514cfb', null, '109482631893680196465');

with subquery as (select cohortID from cohortData where cohortName = 'Bill Nye''s Science Crew') 
  update notificationData set notifSenderCohort = subquery.cohortID from subquery where notifType = 'invite';

with subquery as (select publishID from publicationData where publishArea = 8) 
  update notificationData set notifPublish = subquery.publishID from subquery where notifType = 'review';
with subquery as (select reviewID from reviewData where reviewPoster = '132785234083458612349') 
  update notificationData set notifReview = subquery.reviewID from subquery where notifType = 'review';

with subquery as (select publishID from publicationData where publishArea = 8) 
  update notificationData set notifPublish = subquery.publishID from subquery where notifType = 'comment';
with subquery as (select reviewID from reviewData where reviewPoster = '132785234083458612349') 
  update notificationData set notifReview = subquery.reviewID from subquery where notifType = 'comment';