import { Module } from '@nestjs/common';
import { SnapshotModule } from '../snapshot/snapshot.module.js';
import { DevController } from './dev.controller.js';

@Module({
  imports: [SnapshotModule],
  controllers: [DevController],
})
export class DevModule {}
