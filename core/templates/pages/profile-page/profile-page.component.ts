// Copyright 2014 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Component for the Oppia profile page.
 */

import { OppiaAngularRootComponent } from
  'components/oppia-angular-root.component';

require('base-components/base-content.directive.ts');
require(
  'components/common-layout-directives/common-elements/' +
  'background-banner.component.ts');
require('components/summary-tile/exploration-summary-tile.component.ts');
require('filters/string-utility-filters/truncate.filter.ts');
require('pages/OppiaFooterDirective.ts');

require('domain/utilities/url-interpolation.service.ts');
require('services/user.service.ts');
require('services/date-time-format.service.ts');
require('pages/profile-page/profile-page-backend-api.service');

angular.module('oppia').component('profilePage', {
  template: require('./profile-page.component.html'),
  controller: [
    '$log', '$rootScope', '$scope', 'DateTimeFormatService', 'LoaderService',
    'UrlInterpolationService', 'UserService', 'WindowRef',
    function(
        $log, $rootScope, $scope, DateTimeFormatService, LoaderService,
        UrlInterpolationService, UserService, WindowRef) {
      var ctrl = this;
      const ProfilePageBackendApiService = (
        OppiaAngularRootComponent.profilePageBackendApiService);
      const RatingComputationService = (
        OppiaAngularRootComponent.ratingComputationService);

      var DEFAULT_PROFILE_PICTURE_URL = UrlInterpolationService
        .getStaticImageUrl('/general/no_profile_picture.png');

      ctrl.getLocaleDateString = function(millisSinceEpoch) {
        return DateTimeFormatService.getLocaleDateString(millisSinceEpoch);
      };
      ctrl.$onInit = function() {
        LoaderService.showLoadingScreen('Loading');
        let fetchProfileData = () =>
          ProfilePageBackendApiService.fetchProfileDataAsync();
        fetchProfileData().then(function(data) {
          ctrl.username = {
            title: 'Username',
            value: data.usernameOfViewedProfile,
            helpText: (data.usernameOfViewedProfile)
          };
          ctrl.usernameIsLong = data.usernameOfViewedProfile.length > 16;
          ctrl.userBio = data.userBio;
          ctrl.userDisplayedStatistics = [{
            title: 'Impact',
            value: data.userImpactScore,
            helpText: (
              'A rough measure of the impact of explorations created by ' +
              'this user. Better ratings and more playthroughs improve ' +
              'this score.')
          }, {
            title: 'Created',
            value: data.createdExpSummaries.length
          }, {
            title: 'Edited',
            value: data.editedExpSummaries.length
          }];

          ctrl.userEditedExplorations = data.editedExpSummaries.sort(
            function(exploration1, exploration2) {
              const avgRating1 = RatingComputationService.computeAverageRating(
                exploration1.ratings);
              const avgRating2 = RatingComputationService.computeAverageRating(
                exploration2.ratings);

              if (avgRating1 > avgRating2) {
                return 1;
              } else if (avgRating1 === avgRating2) {
                if (exploration1.numViews > exploration2.numViews) {
                  return 1;
                } else if (
                  exploration1.numViews === exploration2.numViews) {
                  return 0;
                } else {
                  return -1;
                }
              } else {
                return -1;
              }
            }
          );

          ctrl.userNotLoggedIn = !data.username;

          ctrl.isAlreadySubscribed = data.isAlreadySubscribed;
          ctrl.isUserVisitingOwnProfile = data.isUserVisitingOwnProfile;

          ctrl.subscriptionButtonPopoverText = '';

          ctrl.currentPageNumber = 0;
          ctrl.PAGE_SIZE = 6;
          ctrl.startingExplorationNumber = 1;
          ctrl.endingExplorationNumber = 6;
          ctrl.Math = window.Math;
          ctrl.profileIsOfCurrentUser = data.profileIsOfCurrentUser;

          ctrl.changeSubscriptionStatus = function() {
            if (ctrl.userNotLoggedIn) {
              UserService.getLoginUrlAsync().then(
                function(loginUrl) {
                  if (loginUrl) {
                    WindowRef.nativeWindow.location.href = loginUrl;
                  } else {
                    WindowRef.nativeWindow.location.reload();
                  }
                }
              );
            } else {
              if (!ctrl.isAlreadySubscribed) {
                ProfilePageBackendApiService.subscribeAsync(
                  data.usernameOfViewedProfile
                ).then(() => {
                  ctrl.isAlreadySubscribed = true;
                  ctrl.updateSubscriptionButtonPopoverText();
                  $scope.$apply();
                });
              } else {
                ProfilePageBackendApiService.unsubscribeAsync(
                  data.usernameOfViewedProfile
                ).then(() => {
                  ctrl.isAlreadySubscribed = false;
                  ctrl.updateSubscriptionButtonPopoverText();
                  $scope.$apply();
                });
              }
            }
          };

          ctrl.updateSubscriptionButtonPopoverText = function() {
            if (ctrl.userNotLoggedIn) {
              ctrl.subscriptionButtonPopoverText = (
                'Log in or sign up to subscribe to your ' +
                'favorite creators.');
            } else if (ctrl.isAlreadySubscribed) {
              ctrl.subscriptionButtonPopoverText = (
                'Unsubscribe to stop receiving email notifications ' +
                'regarding new explorations published by ' +
                ctrl.username.value + '.');
            } else {
              ctrl.subscriptionButtonPopoverText = (
                'Receive email notifications, whenever ' +
                ctrl.username.value + ' publishes a new exploration.');
            }
          };
          ctrl.updateSubscriptionButtonPopoverText();

          ctrl.goToPreviousPage = function() {
            if (ctrl.currentPageNumber === 0) {
              $log.error('Error: cannot decrement page');
            } else {
              ctrl.currentPageNumber--;
              ctrl.startingExplorationNumber = (
                ctrl.currentPageNumber * ctrl.PAGE_SIZE + 1
              );
              ctrl.endingExplorationNumber = (
                (ctrl.currentPageNumber + 1) * ctrl.PAGE_SIZE
              );
            }
          };
          ctrl.goToNextPage = function() {
            if ((ctrl.currentPageNumber + 1) * ctrl.PAGE_SIZE >= (
              data.editedExpSummaries.length)) {
              $log.error('Error: Cannot increment page');
            } else {
              ctrl.currentPageNumber++;
              ctrl.startingExplorationNumber = (
                ctrl.currentPageNumber * ctrl.PAGE_SIZE + 1
              );
              ctrl.endingExplorationNumber = (
                Math.min(
                  ctrl.numUserPortfolioExplorations,
                  (ctrl.currentPageNumber + 1) * ctrl.PAGE_SIZE)
              );
            }
          };

          ctrl.getExplorationsToDisplay = function() {
            ctrl.explorationsOnPage = [];
            if (ctrl.userEditedExplorations.length === 0) {
              return ctrl.explorationsOnPage;
            }
            ctrl.explorationIndexStart = (
              ctrl.currentPageNumber * ctrl.PAGE_SIZE);
            ctrl.explorationIndexEnd = (
              ctrl.explorationIndexStart + ctrl.PAGE_SIZE - 1);
            for (var ind = ctrl.explorationIndexStart;
              ind <= ctrl.explorationIndexEnd; ind++) {
              ctrl.explorationsOnPage.push(
                ctrl.userEditedExplorations[ind]);
              if (ind === ctrl.userEditedExplorations.length - 1) {
                break;
              }
            }
            return ctrl.explorationsOnPage;
          };

          ctrl.numUserPortfolioExplorations = (
            data.editedExpSummaries.length);
          ctrl.subjectInterests = data.subjectInterests;
          ctrl.firstContributionMsec = data.firstContributionMsec;
          ctrl.profilePictureDataUrl = (
            data.profilePictureDataUrl || DEFAULT_PROFILE_PICTURE_URL);
          LoaderService.hideLoadingScreen();
          $rootScope.$apply();
        });
      };
    }
  ]
});
