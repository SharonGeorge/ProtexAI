import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtPayload } from '../../common/auth/jwt.strategy';
import { Assignment } from './assignment.entity';
import { AssignmentsService } from './assignments.service';

@Resolver()
export class AssignmentsResolver {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Mutation(() => Assignment)
  @UseGuards(JwtAuthGuard)
  acknowledgeAssignment(
    @Args('assignmentId') assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assignmentsService.acknowledge(assignmentId, user.moderatorId);
  }

  @Query(() => [Assignment])
  @UseGuards(JwtAuthGuard)
  myActiveAssignments(@CurrentUser() user: JwtPayload) {
    return this.assignmentsService.getActiveByModerator(user.moderatorId);
  }
}
